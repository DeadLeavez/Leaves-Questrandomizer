import { DependencyContainer, Lifecycle } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { HttpServer } from "@spt/servers/HttpServer";

//Helpers
import { LeavesUtils, RTT_Colors } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesQuestGeneration } from "./LeavesQuestGeneration";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { LeavesIdManager } from "./LeavesIdManager";
import { LeavesQuestManager } from "./LeavesQuestManager";

//item creation
import { CustomItemService } from "@spt/services/mod/CustomItemService";
import type { NewItemFromCloneDetails } from "@spt/models/spt/mod/NewItemDetails";
import { IncomingMessage, ServerResponse } from "http";
import { OnUpdateModService } from "@spt/services/mod/onUpdate/OnUpdateModService";
import { LeavesQuestrandomizerCompatibility } from "./LeavesQuestrandomizerCompatibility";

// TODO:
// Randomize gear if its already there (NOT DONE)
// Zones (Guh!)
// Make a profile-profile quest id translator
// randomize rewards?

export class Questrandomizer implements IPreSptLoadMod
{
    private onUpdateModService: OnUpdateModService;
    private databaseServer: DatabaseServer;
    private customItemService: CustomItemService;
    private httpServer: HttpServer;
    private static originalHandleMethod;
    public static leavesQuestManager: LeavesQuestManager;

    private leavesIdManager: LeavesIdManager;
    private leavesUtils: LeavesUtils;
    private leavesQuestTools: LeavesQuestTools;
    private leavesSettingsManager: LeavesSettingsManager;
    private leavesLocaleGeneration: LeavesLocaleGeneration;

    public preSptLoad( container: DependencyContainer ): void
    {
        container.register<LeavesIdManager>( "LeavesIdManager", LeavesIdManager, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesUtils>( "LeavesUtils", LeavesUtils, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesSettingsManager>( "LeavesSettingsManager", LeavesSettingsManager, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestTools>( "LeavesQuestTools", LeavesQuestTools, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestGeneration>( "LeavesQuestGeneration", LeavesQuestGeneration, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesLocaleGeneration>( "LeavesLocaleGeneration", LeavesLocaleGeneration, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestManager>( "LeavesQuestManager", LeavesQuestManager, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestrandomizerCompatibility>("LeavesQuestrandomizerCompatibility", LeavesQuestrandomizerCompatibility, { lifecycle: Lifecycle.Singleton } );


        this.onUpdateModService = container.resolve<OnUpdateModService>( "OnUpdateModService" );

        this.onUpdateModService.registerOnUpdate(
            "LeavesContextUnload",
            ( timeSinceLastRun: number ) => Questrandomizer.leavesQuestManager.unloadChecker( timeSinceLastRun ),
            () => "LeavesContextUnload" // new route name
        );
    }

    public postDBLoad( container: DependencyContainer ): void
    {
        this.customItemService = container.resolve<CustomItemService>( "CustomItemService" );
        this.httpServer = container.resolve<HttpServer>( "HttpServer" );
        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );

        //Helper Classes
        this.leavesIdManager = container.resolve<LeavesIdManager>( "LeavesIdManager" );
        this.leavesUtils = container.resolve<LeavesUtils>( "LeavesUtils" );
        this.leavesUtils.setModFolder( `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/` );

        Questrandomizer.leavesQuestManager = container.resolve<LeavesQuestManager>( "LeavesQuestManager" );
        Questrandomizer.leavesQuestManager.setQuestRandomizerReference( this );

        this.leavesSettingsManager = container.resolve<LeavesSettingsManager>( "LeavesSettingsManager" );
        this.leavesQuestTools = container.resolve<LeavesQuestTools>( "LeavesQuestTools" );
        this.leavesLocaleGeneration = container.resolve<LeavesLocaleGeneration>( "LeavesLocaleGeneration" );

        this.leavesUtils.setTierList( "assets/data/itemtierlist.jsonc" );
        this.leavesUtils.setDebug( this.leavesSettingsManager.getConfig().DebugEnabled );
        this.leavesIdManager.load( "assets/generated/ids.jsonc" );

        const questpoints = this.leavesUtils.loadFile( "assets/data/questpoints.jsonc" );
        this.leavesQuestTools.setQuestPoints( questpoints );
        this.leavesQuestTools.generateDepthList();

        let easyList: string[] = [];
        
        const depthList = this.leavesQuestTools.getDepthList()
        for ( const questID in depthList )
        {
            if ( depthList[ questID ].depth < 2 && depthList[ questID ].level < 5 )
            {
                //this.leavesUtils.printColor( `\"EasyQ\":\"${ questID }\",` );
            }
        }

        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        //Override the handle
        // @ts-ignore
        Questrandomizer.originalHandleMethod = this.httpServer.handleRequest.bind( this.httpServer );
        // @ts-ignore
        this.httpServer.handleRequest = this.handleRequestReplacement;

        //Set up handbook categories
        this.setupHandbookCategories();

        //Generate a category list
        this.generateWeaponCategorySheet();

        this.leavesIdManager.save();
    }

    public async handleRequestReplacement( req: IncomingMessage, resp: ServerResponse<IncomingMessage> ): Promise<void>
    {
        // Pull sessionId out of cookies and store inside app context
        // @ts-ignore
        const sessionId = this.getCookies( req ).PHPSESSID;
        Questrandomizer.leavesQuestManager.switchContext( sessionId );
        Questrandomizer.originalHandleMethod( req, resp );
    }

    private generateCategoryItem( category: string, handbookParent: string ): string
    {
        const leavesUp: NewItemFromCloneDetails = {
            itemTplToClone: "574eb85c245977648157eec3",
            overrideProperties: {
                Prefab: {
                    path: "assets/content/items/barter/item_info_book_bakeezy/item_info_book_bakeezy.bundle",
                    rcid: ""
                }
            },
            newId: this.leavesIdManager.get( category ),
            parentId: "567849dd4bdc2d150f8b456e",
            handbookParentId: handbookParent,
            fleaPriceRoubles: 10000,
            handbookPriceRoubles: 10000,
            locales: {
                en: {
                    name: "ERROR",
                    shortName: "ERROR",
                    description: "IF YOU EVER SEE THIS SOMETHING HAS GONE WRONG!",
                },
            },
        };

        this.customItemService.createItemFromClone( leavesUp );

        return leavesUp.newId;
    }

    private setupHandbookCategories()
    {
        let handbookDB = this.databaseServer.getTables().templates.handbook;

        const questrandomizerCategory = {
            "Id": this.leavesIdManager.get( "TopLevelHandbookCategory" ),
            "ParentId": null,
            "Icon": "/files/handbook/icon_barter_valuables.png", //Make my own icon?
            "Color": "",
            "Order": "14"
        };
        //Weapon categories
        const weaponCategory = {
            "Id": this.leavesIdManager.get( "WeaponCategoryHandbookID" ),
            "ParentId": this.leavesIdManager.get( "TopLevelHandbookCategory" ),
            "Icon": "/files/handbook/icon_weapons_pistols.png", //Make my own icon?
            "Color": "",
            "Order": "2"
        };
        //Mod categories
        const modCategory = {
            "Id": this.leavesIdManager.get( "ModCategoryHandbookID" ),
            "ParentId": this.leavesIdManager.get( "TopLevelHandbookCategory" ),
            "Icon": "/files/handbook/icon_barter_tools.png", //Make my own icon?
            "Color": "",
            "Order": "1"
        };

        this.leavesLocaleGeneration.addLocaleToAll( `${ this.leavesUtils.RTT_Rainbowify( "[Questrandomizer]" ) }`, questrandomizerCategory.Id );

        handbookDB.Categories.push( questrandomizerCategory );
        handbookDB.Categories.push( weaponCategory );
        handbookDB.Categories.push( modCategory );
    }

    public editQuest( quest: IQuest ): IQuest
    {
        //QUEST — There is only one quest
        //- TASK  — There can be multiple tasks.
        //- - CONDITIONS — There can be many parts to conditions

        if ( this.leavesSettingsManager.getConfig().questBlacklist.includes( quest._id ) )
        {
            return quest;
        }

        //Check if it has a kill failstate
        let hasKillsFailstate = false;
        if ( quest.conditions.Fail )
        {
            hasKillsFailstate = this.leavesUtils.searchObject( "Kills", quest.conditions.Fail );
        }

        //Check if quest has kill type
        if ( !this.leavesUtils.searchObject( "Kills", quest.conditions.AvailableForFinish ) && Math.random() < this.leavesSettingsManager.getConfig().addKillObjectiveToQuestChance && !hasKillsFailstate )
        {
            const tempTarget = this.leavesSettingsManager.getValidTargets()[ randomInt( this.leavesSettingsManager.getValidTargets().length ) ];
            const tempKillcount = this.leavesSettingsManager.getConfig().addKillObjectiveKillCount;
            this.leavesQuestTools.addKillObjectiveToQuest( quest, tempTarget, tempKillcount );
            this.leavesUtils.printColor( "Added Kill objective to quest", LogTextColor.YELLOW, true );
        }
        
        //Check if quest has handover type
        let editHandOverOverride = false;
        if ( !this.leavesUtils.searchObject( "HandoverItem", quest.conditions.AvailableForFinish ) && Math.random() < this.leavesSettingsManager.getConfig().addHandOverObjectiveToQuestChance )
        {
            this.leavesQuestTools.addHandOverObjectiveToQuest( quest, this.leavesSettingsManager.getConfig().addHandOverObjectiveBaseCount, [ this.leavesUtils.getRandomItemFromTier( 5 ) ] );
            editHandOverOverride = true;
            this.leavesUtils.printColor( "Added Hand Over objective to quest", LogTextColor.YELLOW, true );
        }

        let editedHandoverItemTask = false;

        //Loop all AvailableForFinish conditions
        for ( let task of quest.conditions.AvailableForFinish )
        {
            if ( task.conditionType === "FindItem" )
            {
                //Do nothing for now.
            }
            else if ( task.conditionType === "LeaveItemAtLocation" )
            {
                //Do nothing for now.
            }
            else if ( task.conditionType === "CounterCreator" )
            {
                this.editCounterCreatorTask( task, hasKillsFailstate, quest._id );
            }
            else if ( task.conditionType === "HandoverItem" )
            {
                editedHandoverItemTask = this.editHandoverItemTask( task, editHandOverOverride );
            }

            //Purge visibility conditions.
            task.visibilityConditions = [];

        }
        if ( editedHandoverItemTask )
        {
            this.leavesQuestTools.purgeFindItemTasks( quest.conditions.AvailableForFinish );
        }

        //Edit quest location
        quest.location = this.leavesSettingsManager.getLocationIDMap()[ this.leavesQuestTools.getQuestLocationText( quest ).toLocaleLowerCase() ];

        return quest;
    }

    private editHandoverItemTask( task: IQuestCondition, IgnoreChance: boolean ): boolean
    {
        //Chance to even do this.
        if ( Math.random() > this.leavesSettingsManager.getConfig().chanceToEditHandoverCondition && IgnoreChance === false )
        {
            return false;
        }

        const itemDB = this.databaseServer.getTables().templates.items;
        const originalItem = task.target[ 0 ];
        //Ignore quest items
        if ( !itemDB[ originalItem ] )
        {
            this.leavesUtils.printColor( "[Questrandomizer]Found a quest that requires a broken item. Report to the author of the quest above." );
            return false;
        }

        if ( itemDB[ originalItem ]._props.QuestItem )
        {
            return false;
        }

        //Item blacklist
        const originalItemParent = itemDB[ originalItem ]._parent;
        if ( this.leavesSettingsManager.getConfig().handoverItemBlacklist.includes( originalItem ) || this.leavesSettingsManager.getConfig().handoverItemBlacklist.includes( originalItemParent ) )
        {
            return false;
        }

        this.leavesQuestTools.randomizeHandover( task, originalItem );

        return true;
    }

    private editCounterCreatorTask( task: IQuestCondition, hasKillsFailstate: boolean, questID: string )
    {
        const conditions = task.counter.conditions;

        let flags =
        {
            hasInZone: -1,
            hasKills: -1,
            hasLocation: -1,
            whatLoctations: [],
            hasDistance: -1,
            hasTime: -1,
            hasBodyparts: -1,
            hasWeapon: -1,
            hasSpecificWeapon: -1,
            whatWeaponOrGroup: "",
            hasSavageRole: -1,
            hasKillFailstate: hasKillsFailstate ? 1 : -1,
            hasEquipment: -1,
            questID: questID,
            isEasyQuest: false,
            killsEnemyTypeDistance: 0
        }

        //Check if its on the list of "easy" quests
        flags.isEasyQuest = this.leavesSettingsManager.getConfig().easierQuestList.includes( flags.questID );
        this.leavesUtils.printColor( "Easy quest:" + flags.isEasyQuest );

        //Check what countercreator conditions exist
        for ( let counterConditionIndex = 0; counterConditionIndex < conditions.length; counterConditionIndex++ )
        {
            if ( conditions[ counterConditionIndex ].conditionType === "Kills" )
            {
                flags.hasKills = counterConditionIndex;

                if ( conditions[ counterConditionIndex ].savageRole?.length > 0 ) //We need to check this here, because this info is important.
                {
                    flags.hasSavageRole = 1;
                }
            }
            else if ( conditions[ counterConditionIndex ].conditionType === "Location" )
            {
                flags.hasLocation = counterConditionIndex;
            }
            else if ( conditions[ counterConditionIndex ].conditionType === "InZone" )
            {
                //flags.hasInZone = counterConditionIndex; //For now lets purge them.
                conditions.splice( counterConditionIndex, 1 );
                counterConditionIndex--;
                continue;
            }
            else if ( conditions[ counterConditionIndex ].conditionType === "Equipment" )
            {
                flags.hasEquipment = counterConditionIndex;
            }
        }

        //Edit kill quests
        if ( flags.hasKills >= 0 && flags.hasKillFailstate < 0 && Math.random() < this.leavesSettingsManager.getConfig().chanceToEditKillConditions )
        {
            //Add location to quest potentially.
            if ( flags.hasLocation === -1 && Math.random() < this.leavesSettingsManager.getConfig().chanceToAddLocations && flags.hasSavageRole < 0 )
            {
                flags.hasLocation = this.leavesQuestTools.addLocationToQuest( conditions, flags );
            }
            else if ( flags.hasLocation >= 0 ) //Edit location
            {
                this.leavesQuestTools.randomizeLocations( conditions[ flags.hasLocation ], flags )
            }

            if ( flags.hasLocation >= 0 )
            {
                //Check for GZ, and add the _high version to it. //MOVE THIS OUTSIDE??
                if ( conditions[ flags.hasLocation ].target.includes( "Sandbox" ) )
                {
                    ( conditions[ flags.hasLocation ].target as string[] ).push( "Sandbox_high" );

                }

                //Save the locations to flags
                flags.whatLoctations = structuredClone( conditions[ flags.hasLocation ].target as string[] );
            }

            //Add gear
            if ( flags.hasEquipment < 0 && Math.random() < this.leavesSettingsManager.getConfig().chanceToAddGear && !flags.isEasyQuest )
            {
                const tempGearPieces = this.leavesUtils.getUniqueWeightedValues<string>( this.leavesSettingsManager.getGearList(), this.leavesSettingsManager.getConfig().addGearCount );
                flags.hasEquipment = this.leavesQuestTools.addGearToQuest( conditions, tempGearPieces );
            }

            //Edit zones possibly (PROBABLY WONT DO)
            if ( flags.hasInZone >= 0 )
            {

            }

            //We edit the kill quest
            this.editKillsDetails( conditions[ flags.hasKills ], flags );

            //edit KILL count if its not a special type
            if ( flags.hasSavageRole < 0 )
            {
                if ( flags.killsEnemyTypeDistance > 0 )
                {
                    task.value = Math.round( Math.max( task.value as number / ( flags.killsEnemyTypeDistance * this.leavesSettingsManager.getConfig().killCountWhenTargetTypeChangesFactor ), 5 ) );
                }
                if ( flags.killsEnemyTypeDistance < 0 )
                {
                    task.value = Math.round( task.value as number * ( Math.abs( flags.killsEnemyTypeDistance ) * this.leavesSettingsManager.getConfig().killCountWhenTargetTypeChangesFactor ) );
                }
                task.value = this.leavesUtils.generateValueAdjustment( task.value as number, this.leavesSettingsManager.getConfig().adjustKillCountFactorsUpDown );
            }

            this.leavesLocaleGeneration.generateKillsLocale( task, flags )
        }
        //We don't edit anything else with counters for now.
        return;
    }

    private editKillsDetails( killsCondition: IQuestConditionCounterCondition, flags: any )
    {

        //Target
        if ( this.leavesSettingsManager.getValidTargets().includes( killsCondition.target as string ) )
        {
            this.leavesQuestTools.randomizeTarget( killsCondition, flags );
        }

        //Body Parts
        if ( killsCondition.bodyPart && flags.hasSavageRole === -1 && !flags.isEasyQuest )
        {
            this.leavesQuestTools.randomizeBodyPart( killsCondition, flags );
        }

        //Time of day
        if ( killsCondition.daytime && flags.hasSavageRole < 0 )
        {
            //Disable time on the maps that don't do time.
            this.leavesQuestTools.randomizeTimeOfDay( killsCondition, flags );
        }

        //Distance
        if ( killsCondition.distance )
        {
            this.leavesQuestTools.randomizeDistance( killsCondition, flags );
        }

        //Weapon
        if ( killsCondition.weapon && !flags.isEasyQuest )
        {
            this.leavesQuestTools.randomizeWeapons( killsCondition, flags );
        }

        //Gear
        if ( flags.hasEquipment )
        {
            //Randomize
        }
        //LEAVE FOR NOW
    }

    public generateWeaponCategorySheet()
    {
        //Generate the items
        for ( const category in this.leavesSettingsManager.getWeaponCategories().categories )
        {
            this.generateCategoryItem( category, this.leavesIdManager.get( "WeaponCategoryHandbookID" ) );
        }

        for ( const modGroup in this.leavesSettingsManager.getWeaponCategories().modCategories )
        {
            this.generateCategoryItem( modGroup, this.leavesIdManager.get( "ModCategoryHandbookID" ) );
        }

        //Create the files and generate locales
        for ( const language in this.databaseServer.getTables().locales.global )
        {
            let sheet = ""; //The whole file

            this.leavesLocaleGeneration.addLocaleTo(
                language,
                this.leavesUtils.RTT_Color( this.leavesLocaleGeneration.getLoc( "WeaponCategory", language ), RTT_Colors.GREEN ),
                this.leavesIdManager.get( "WeaponCategoryHandbookID" )
            );
            for ( const category in this.leavesSettingsManager.getWeaponCategories().categories )
            {
                const weaponGroup = this.leavesSettingsManager.getWeaponCategories().categories[ category ];

                //Add weapon list
                let tempLocaleForSheetCategory = this.leavesLocaleGeneration.getLoc( "SheetCategory", language );
                let tempLocaleForWeaponCategory = this.leavesLocaleGeneration.getWeaponCategoryLocale( category, language );

                let categorysheet = this.leavesUtils.RTT_Size( `[${ tempLocaleForSheetCategory }: ${ tempLocaleForWeaponCategory }]`, "+4px" ); //HERE
                categorysheet += `\n-----------------------------\n`;
                if ( weaponGroup.weapons.length === 0 )
                {
                    categorysheet += `\t${ this.leavesLocaleGeneration.getLoc( "AnyWeapon", language ) }\n`;
                }
                else
                {
                    for ( const weapon of weaponGroup.weapons )
                    {
                        categorysheet += `\t${ this.leavesUtils.getLocale( language, weapon, " Name" ) }\n`;
                    }
                }
                categorysheet += "\n";

                categorysheet += this.addToCategorySheet( weaponGroup, "mods-inclusive", "RequiredMods", language );
                categorysheet += this.addToCategorySheet( weaponGroup, "mods-exclusive", "ForbiddenMods", language );

                const categoryID = this.leavesIdManager.get( category );
                this.leavesLocaleGeneration.addFullLocale( language, tempLocaleForWeaponCategory, tempLocaleForWeaponCategory, categorysheet, categoryID );
                sheet += categorysheet;
            }

            sheet += `\n-----------------------------\n`;
            sheet += `-----------------------------\n`;

            this.leavesLocaleGeneration.addLocaleTo(
                language,
                this.leavesUtils.RTT_Color( this.leavesLocaleGeneration.getLoc( "ModCategory", language ), RTT_Colors.BLUE ),
                this.leavesIdManager.get( "ModCategoryHandbookID" ) );
            for ( const category in this.leavesSettingsManager.getWeaponCategories().modCategories )
            {
                const modGroup = this.leavesSettingsManager.getWeaponCategories().modCategories[ category ];

                //Top/Title
                let modGroupSheet = `\n[${ this.leavesLocaleGeneration.getLoc( "SheetCategory", language ) }: ${ category }] - `;
                modGroupSheet += modGroup.together ? this.leavesLocaleGeneration.getLoc( "AllRequired", language ) : this.leavesLocaleGeneration.getLoc( "OneRequired", language );
                modGroupSheet = this.leavesUtils.RTT_Size( modGroupSheet, "+4px" );
                modGroupSheet += `\n-----------------------------\n`;

                //Add each mod
                for ( const mod of modGroup.mods )
                {
                    modGroupSheet += `\t${ this.leavesUtils.getLocale( language, mod, " Name" ) }\n`;
                }
                const categoryID = this.leavesIdManager.get( category );

                this.leavesLocaleGeneration.addFullLocale( language, category, category, modGroupSheet, categoryID );

                sheet += modGroupSheet;
            }
            this.leavesUtils.saveFile( sheet, `categories/categories_${ language }.txt`, false );
        }
    }

    public addToCategorySheet( weaponGroup: any, modcategory: string, localename: string, language: string )
    {
        let categorysheet = ``;

        if ( Object.keys( weaponGroup[ modcategory ] ).length > 0 )
        {
            categorysheet += this.leavesUtils.RTT_Size( `[${ this.leavesLocaleGeneration.getLoc( localename, language ) }]`, "+4px" );
            categorysheet += `\n-----------------------------\n`;

            let firstDone = false;
            for ( const modgroup of Object.keys( weaponGroup[ modcategory ] ) )
            {
                if ( firstDone )
                {
                    categorysheet += weaponGroup[ modcategory ][ modgroup ] ? `\t${ this.leavesLocaleGeneration.getLoc( "AND", language ) }\n` : `\t${ this.leavesLocaleGeneration.getLoc( "OR", language ) }\n`; //ADD LOCALE TO THIS
                }
                categorysheet += `\t${ modgroup }\n`;
                firstDone = true;
            }
        }

        return categorysheet;
    }
}

module.exports = { mod: new Questrandomizer() }
