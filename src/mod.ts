import { DependencyContainer, Lifecycle } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";
import { HttpServer } from "@spt/servers/HttpServer";

//Helpers
import { LeavesUtils, RTT_Colors } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesQuestGeneration } from "./LeavesQuestGeneration";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { LeavesIdManager } from "./LeavesIdManager";
import { LeavesContextSwitcher } from "./LeavesContextSwitcher";

//item creation
import { CustomItemService } from "@spt/services/mod/CustomItemService";
import type { NewItemFromCloneDetails } from "@spt/models/spt/mod/NewItemDetails";
import { IncomingMessage, ServerResponse } from "http";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ICoreConfig } from "@spt/models/spt/config/ICoreConfig";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { ContextVariableType } from "@spt/context/ContextVariableType";

// TODO:
// Locale to weapon categories?
// Randomize gear if its already there (NOT DONE)
// Zones
// Blacklist items

export class Questrandomizer implements IPreSptLoadMod
{
    private databaseServer: DatabaseServer;
    private weightedRandomHelper: WeightedRandomHelper;
    private handbookHelper: HandbookHelper;
    private customItemService: CustomItemService;
    private httpServer: HttpServer;

    public static leavesContextSwitcher: LeavesContextSwitcher;

    private leavesIdManager: LeavesIdManager;
    private leavesUtils: LeavesUtils;
    private leavesQuestTools: LeavesQuestTools;
    private leavesQuestGeneration: LeavesQuestGeneration;
    private leavesSettingsManager: LeavesSettingsManager;
    private leavesLocaleGeneration: LeavesLocaleGeneration;

    private QuestDB: any;

    private setWeaponGroup( condition: IQuestConditionCounterCondition, flags: any )
    {
        //Check if were gonna use a category or specific weapon
        if ( Math.random() < this.leavesSettingsManager.getConfig().chanceForSpecificWeapon )
        {
            const count = this.leavesSettingsManager.getWeaponCategories().specificWeapon.length;
            let weapon: string = this.leavesSettingsManager.getWeaponCategories().specificWeapon[ randomInt( count ) ];
            flags.hasSpecificWeapon = 1;
            flags.whatWeaponOrGroup = weapon;
            condition.weapon = [ weapon ];
            return;
        }
        let group = this.weightedRandomHelper.getWeightedValue<string>( this.leavesSettingsManager.getweaponCategoriesWeighting() );
        flags.whatWeaponOrGroup = group;
        const weaponGroup = this.leavesSettingsManager.getWeaponCategories().categories[ group ];
        condition.weapon = weaponGroup.weapons;

        //Add weapon mods
        const modsInclusive = weaponGroup[ "mods-inclusive" ];
        for ( const modgroup in modsInclusive )
        {
            condition.weaponModsInclusive = this.getModGroup( modgroup, condition.weaponModsInclusive, modsInclusive[ modgroup ] );
        }

        const modsExclusive = weaponGroup[ "mods-exclusive" ]
        for ( const modgroup in modsExclusive )
        {
            condition.weaponModsExclusive = this.getModGroup( modgroup, condition.weaponModsExclusive, modsExclusive[ modgroup ] );
        }
        //this.leavesUtils.debugJsonOutput( condition );
    }

    private getModGroup( modGroup: string, weaponModsCurrent: string[][], merge: boolean ): string[][]
    {
        if ( !this.leavesSettingsManager.getWeaponCategories().modCategories[ modGroup ] )
        {
            this.leavesUtils.printColor( `Tried to use missing weapon mod category ${ modGroup }`, LogTextColor.RED );
            return weaponModsCurrent;
        }

        const modCategory = this.leavesSettingsManager.getWeaponCategories().modCategories[ modGroup ];

        //Check for faulty merge
        if ( merge && weaponModsCurrent.length === 0 )
        {
            this.leavesUtils.printColor( `Tried to merge mod group with empty mods list. Is your order wrong?`, LogTextColor.RED );
            return weaponModsCurrent;
        }

        if ( merge )
        {
            //If together, just push the mods to each array.
            if ( modCategory.together )
            {
                for ( let entry of weaponModsCurrent )
                {
                    entry.push( ...modCategory.mods );
                }
            }
            //If not, we have to go ham.
            else
            {
                let tempArray = [];
                for ( const existingModGroup of weaponModsCurrent )
                {
                    for ( const modToAdd of modCategory.mods )
                    {
                        let newModGroup = [];
                        newModGroup.push( ...existingModGroup );
                        newModGroup.push( modToAdd );
                        tempArray.push( newModGroup );
                    }
                }
                //this.leavesUtils.debugJsonOutput( tempArray );
                return tempArray;
            }
        }

        if ( modCategory.together )
        {
            return [ modCategory.mods ];
        }
        else
        {
            let tempArray = [];
            for ( const mod of modCategory.mods )
            {
                tempArray.push( [ mod ] );
            }
            return tempArray;
        }

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

    public preSptLoad( container: DependencyContainer ): void
    {
        container.register<LeavesIdManager>( "LeavesIdManager", LeavesIdManager, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesUtils>( "LeavesUtils", LeavesUtils, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesSettingsManager>( "LeavesSettingsManager", LeavesSettingsManager, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestTools>( "LeavesQuestTools", LeavesQuestTools, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestGeneration>( "LeavesQuestGeneration", LeavesQuestGeneration, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesLocaleGeneration>( "LeavesLocaleGeneration", LeavesLocaleGeneration, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesContextSwitcher>( "LeavesContextSwitcher", LeavesContextSwitcher, { lifecycle: Lifecycle.Singleton } );
    }

    public postDBLoad( container: DependencyContainer ): void
    {
        this.weightedRandomHelper = container.resolve<WeightedRandomHelper>( "WeightedRandomHelper" );
        this.handbookHelper = container.resolve<HandbookHelper>( "HandbookHelper" );
        this.customItemService = container.resolve<CustomItemService>( "CustomItemService" );
        this.httpServer = container.resolve<HttpServer>( "HttpServer" );
        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );

        //Helper Classes
        this.leavesIdManager = container.resolve<LeavesIdManager>( "LeavesIdManager" );
        this.leavesUtils = container.resolve<LeavesUtils>( "LeavesUtils" );
        this.leavesUtils.setModFolder( `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/` );
        Questrandomizer.leavesContextSwitcher = container.resolve<LeavesContextSwitcher>( "LeavesContextSwitcher" );
        Questrandomizer.leavesContextSwitcher.setQuestRandomizerReference( this );

        this.leavesSettingsManager = container.resolve<LeavesSettingsManager>( "LeavesSettingsManager" );
        this.leavesQuestTools = container.resolve<LeavesQuestTools>( "LeavesQuestTools" );
        this.leavesQuestGeneration = container.resolve<LeavesQuestGeneration>( "LeavesQuestGeneration" );
        this.leavesLocaleGeneration = container.resolve<LeavesLocaleGeneration>( "LeavesLocaleGeneration" );

        this.leavesUtils.setTierList( "config/itemtierlist.jsonc" );
        this.leavesIdManager.load( "assets/generated/ids.jsonc" );

        const questpoints = this.leavesUtils.loadFile( "assets/data/questpoints.jsonc" );
        this.leavesQuestTools.setQuestPoints( questpoints );

        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        //Thanks AcidPhantasm
        const configServer = container.resolve<ConfigServer>( "ConfigServer" );
        const sptConfig = configServer.getConfig<ICoreConfig>( ConfigTypes.CORE );
        const sptVersion = globalThis.G_SPTVERSION || sptConfig.sptVersion;

        switch ( sptVersion )
        {
            case "3.10.0":
            case "3.9.8":
                this.leavesUtils.printColor( "[Questrandomizer] Supported version found." + sptVersion );
                this.httpServer.handleRequest = this.handleRequestReplacement310; //Seems to be the same in 3.9.x
                break;
            default:
                this.leavesUtils.printColor( "UNKNOWN SPT VERSION. THIS IS UNSUPPORTED. LITERALLY WHOLE OF SPT MIGHT BREAK. NO SUPPORT WILL BE PROVIDED", LogTextColor.RED );
                this.httpServer.handleRequest = this.handleRequestReplacement310;
                break;
        }

        //Set up handbook categories
        this.setupHandbookCategories();

        let questWhitelist: string[] = [];
        if ( this.leavesSettingsManager.getConfig().enableQuestWhilelist )
        {
            questWhitelist = this.leavesUtils.loadFile( "config/questwhitelist.jsonc" ).whitelist;
        }
/*
        //Init questDB
        this.QuestDB = this.leavesUtils.loadFile( "assets/generated/quests.jsonc" );

        //Iterate the regular quest database see if any new quests are added.
        const serverQuestDB = this.databaseServer.getTables().templates.quests;
        for ( const originalQuest in serverQuestDB )
        {
            //Check whitelist.
            if ( !questWhitelist.includes( originalQuest ) && this.leavesSettingsManager.getConfig().enableQuestWhilelist )
            {
                this.leavesUtils.printColor( `Ignoring:${ originalQuest } - ${ serverQuestDB[ originalQuest ].QuestName } due to not being on whitelist.` );
                continue;
            }

            //Check if quest has been generated before.
            if ( !this.QuestDB[ originalQuest ] )
            {
                //If it hasn't, make get an edited copy of the quest.
                this.QuestDB[ originalQuest ] = this.getEditedQuest( originalQuest );
            }
        }

        //We're done with checking, so now we override the original quest DB with our new quests.
        for ( const leavesQuestId in this.QuestDB )
        {
            const leavesQuest = this.QuestDB[ leavesQuestId ];

            this.databaseServer.getTables().templates.quests[ leavesQuestId ] = leavesQuest;
        }

        this.leavesUtils.saveFile( this.QuestDB, "assets/generated/quests.jsonc" );
        */

        //Generate a category list
        this.generateWeaponCategorySheet();

        //this.leavesQuestGeneration.generateQuest();


        //this.leavesUtils.dataDump();
        this.leavesSettingsManager.saveChanges();
        this.leavesIdManager.save( "assets/generated/ids.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Finished Setting Everything Up! SPT are some pretty extraordinary dudes or something` );
        this.leavesUtils.saveFile( this.databaseServer.getTables().templates.quests, "dump/quests.json", true );
        this.leavesUtils.saveFile( this.databaseServer.getTables().locales.global, "dump/locales.json", true );
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
            // MODIFIED ABCD
            const tempTarget = this.leavesSettingsManager.getValidTargets()[ randomInt( this.leavesSettingsManager.getValidTargets().length ) ];
            const tempKillcount = this.leavesSettingsManager.getConfig().addKillObjectiveKillCount;
            this.leavesQuestTools.addKillObjectiveToQuest( quest, tempTarget, tempKillcount );
            this.leavesUtils.printColor( "Added Kill objective to quest", LogTextColor.YELLOW );
        }
        let editHandOverOverride = false;
        if ( !this.leavesUtils.searchObject( "HandoverItem", quest.conditions.AvailableForFinish ) && Math.random() < this.leavesSettingsManager.getConfig().addHandOverObjectiveToQuestChance )
        {
            this.leavesQuestTools.addHandOverObjectiveToQuest( quest, this.leavesSettingsManager.getConfig().addHandOverObjectiveBaseCount, [ this.leavesUtils.getRandomItemFromTier( 5 ) ] );
            editHandOverOverride = true;
            this.leavesUtils.printColor( "Added Hand Over objective to quest", LogTextColor.YELLOW );
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

        let newTarget = [];
        let categoryName = "";

        if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToRequireItemCategory ) //Category
        {
            const keys = Object.keys( this.leavesSettingsManager.gethandoverCategories() );
            const category = keys[ randomInt( keys.length ) ];
            newTarget = this.leavesSettingsManager.gethandoverCategories()[ category ];
            categoryName = category;

            //Increase item handover count
            task.value = task.value as number * this.leavesSettingsManager.getConfig().itemCategoryMultiplier;
        }
        else //Single item
        {
            let tier = this.leavesUtils.getTierFromID( originalItem );
            if ( tier == -1 )
            {
                const cost = this.handbookHelper.getTemplatePrice( originalItem );
                tier = this.leavesUtils.getClosestTier( Math.round( cost / this.leavesSettingsManager.getConfig().handoverItemUnknownItemValueDivider ) );
            }

            newTarget.push( this.leavesUtils.getRandomItemFromTier( tier ) );
        }

        task.target = newTarget;


        //Found in raid.
        if ( Math.random() < this.leavesSettingsManager.getConfig().chanceHandoverNeedsFIR )
        {
            task.onlyFoundInRaid = true;
        }

        //Remove gear condition
        task.maxDurability = 100;
        task.minDurability = 0;

        //Strip visibilityConditions
        task.visibilityConditions = [];

        const previousValue: number = task.value as number;
        task.value = this.leavesUtils.generateValueAdjustment( previousValue, this.leavesSettingsManager.getConfig().adjustHandoverCountFactorsUpDown );

        // MODIFIED ABCD
        this.leavesLocaleGeneration.generateHandoverItemLocale( task, categoryName );

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
                const tempMaps: string[] = this.leavesUtils.getUniqueValues<string>( this.leavesSettingsManager.getValidMaps(), this.leavesSettingsManager.getConfig().locationCount );
                flags.hasLocation = this.leavesQuestTools.addLocationToQuest( conditions, tempMaps );
            }
            else if ( flags.hasLocation >= 0 ) //Edit location
            {
                this.editLocations( conditions[ flags.hasLocation ], flags )
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

    private editLocations( locations: IQuestConditionCounterCondition, flags: any, )
    {
        //If we have special enemies, we don't want to fuck with the location.
        if ( flags.hasSavageRole >= 0 )
        {
            return;
        }

        let mapCount = 1

        //Generate new map
        if ( flags.isEasyQuest ) //If a quest is on the list, we use the easy map setup.
        {
            //this.leavesUtils.printColor( `Using easier map for this quest. QUID: ${flags.questID}` );
            locations.target = this.leavesUtils.getUniqueValues( this.leavesSettingsManager.getEasyMaps(), mapCount );
        }
        else //Else we just use any map.
        {
            //this.leavesUtils.printColor( `Using hard map for this quest. QUID: ${flags.questID}` );
            locations.target = this.leavesUtils.getUniqueValues( this.leavesSettingsManager.getValidMaps(), mapCount );
        }
    }

    private editKillsDetails( killsCondition: IQuestConditionCounterCondition, flags: any )
    {

        //Target
        if ( this.leavesSettingsManager.getValidTargets().includes( killsCondition.target as string ) )
        {
            if ( killsCondition.savageRole?.length > 0 )
            {
                flags.hasSavageRole = 1;
            }
            else
            {
                const validTargets = this.leavesSettingsManager.getValidTargets()
                const previousTarget: string = killsCondition.target as string;
                killsCondition.target = validTargets.at( randomInt( this.leavesSettingsManager.getValidTargets().length - 1 ) );
                flags.killsEnemyTypeDistance = validTargets.indexOf( previousTarget ) - validTargets.indexOf( killsCondition.target );
            }
        }

        //Body Parts
        if ( killsCondition.bodyPart && flags.hasSavageRole === -1 && !flags.isEasyQuest )
        {
            if ( killsCondition.bodyPart.length > 0 )
            {
                //check if the quest has body part requirement.
                killsCondition.bodyPart = this.getBodyparts( killsCondition.bodyPart.length );
                flags.hasBodyparts = killsCondition.bodyPart.length;
            }
            else if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddBodypart )
            {
                //Chance to add it.
                killsCondition.bodyPart = this.getBodyparts( 2 );
                flags.hasBodyparts = 2;
            }
        }

        //Time of day
        if ( killsCondition.daytime && flags.hasSavageRole < 0 )
        {
            //Disable time on the maps that don't do time.
            if ( flags.whatLoctations.includes( "factory4_day" ) || flags.whatLoctations.includes( "factory4_night" ) || flags.whatLoctations.includes( "laboratory" ) )            //Convert to array?
            {
                killsCondition.daytime.from = 0;
                killsCondition.daytime.to = 0;
                flags.hasTime = -1;
            }
            else if ( killsCondition.daytime.from === 0 && killsCondition.daytime.to === 0 ) //Has no time of day requirement
            {
                if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddTimeOfDay && !flags.isEasyQuest ) //And we add it by random chance.
                {
                    killsCondition.daytime.from = randomInt( 23 );
                    killsCondition.daytime.to = ( killsCondition.daytime.from + 6 ) % 24;
                    flags.hasTime = 1;
                }
            }
            else //Has time of day requirement. We randomize it
            {
                //Might de-duplicate the code later.
                killsCondition.daytime.from = randomInt( 23 );
                killsCondition.daytime.to = ( killsCondition.daytime.from + 6 ) % 24;
                flags.hasTime = 1;
            }
        }

        //Distance
        if ( killsCondition.distance )
        {
            if ( flags.whatLoctations.includes( "factory4_day" ) || flags.whatLoctations.includes( "factory4_night" ) || flags.whatLoctations.includes( "laboratory" ) || flags.isEasyQuest )
            {
                killsCondition.distance.compareMethod = ">=";
                killsCondition.distance.value = 0;
                flags.hasDistance = -1;
            }
            else if ( killsCondition.distance.value > 0 ) //If there is a range requirement
            {
                killsCondition.distance.compareMethod = randomInt( 2 ) > 0 ? ">=" : "<=";
                killsCondition.distance.value = ( randomInt( 4 ) + 2 ) * 10;
                flags.hasDistance = 1;
            }
            else if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddDistance ) //We add it by chance
            {
                killsCondition.distance.compareMethod = randomInt( 2 ) > 0 ? ">=" : "<=";
                killsCondition.distance.value = ( randomInt( 4 ) + 2 ) * 10;
                flags.hasDistance = 1;
            }
        }

        //Weapon
        if ( killsCondition.weapon && !flags.isEasyQuest )
        {
            if ( killsCondition.weapon.length > 0 )
            {
                flags.hasWeapon = 1;
                this.setWeaponGroup( killsCondition, flags );
            }
            else if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddWeapon )
            {
                flags.hasWeapon = 1;
                this.setWeaponGroup( killsCondition, flags );
            }
        }

        //Gear
        if ( flags.hasEquipment )
        {
            //Randomize
        }
        //LEAVE FOR NOW
    }

    private getBodyparts( count: number ): string[]
    {
        let tempArray = this.leavesUtils.getUniqueValues( this.leavesSettingsManager.getBodyParts(), count );
        let newArray = [];
        for ( const item of tempArray )
        {
            switch ( item )
            {
                case "Arms":
                    newArray.push( "LeftArm" );
                    newArray.push( "RightArm" );
                    break;
                case "Legs":
                    newArray.push( "LeftLeg" );
                    newArray.push( "RightLeg" );
                    break;
                default:
                    newArray.push( item );
                    break;
            }
        }
        return newArray;
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

    public async handleRequestReplacement310( req: IncomingMessage, resp: ServerResponse<IncomingMessage> ): Promise<void>
    {
        // Pull sessionId out of cookies and store inside app context
        const sessionId = this.getCookies( req ).PHPSESSID;
        Questrandomizer.leavesContextSwitcher.switchContext( sessionId );
        this.applicationContext.addValue( ContextVariableType.SESSION_ID, sessionId );

        // Extract headers for original IP detection
        const realIp = req.headers[ "x-real-ip" ] as string;
        const forwardedFor = req.headers[ "x-forwarded-for" ] as string;
        const clientIp = realIp || ( forwardedFor ? forwardedFor.split( "," )[ 0 ].trim() : req.socket.remoteAddress );

        if ( this.httpConfig.logRequests )
        {
            const isLocalRequest = this.isLocalRequest( clientIp );
            if ( typeof isLocalRequest !== "undefined" )
            {
                if ( isLocalRequest )
                {
                    this.logger.info( this.localisationService.getText( "client_request", req.url ) );
                } else
                {
                    this.logger.info(
                        this.localisationService.getText( "client_request_ip", {
                            ip: clientIp,
                            url: req.url.replaceAll( "/", "\\" ), // Localisation service escapes `/` into hex code `&#x2f;`
                        } ),
                    );
                }
            }
        }

        for ( const listener of this.httpListeners )
        {
            if ( listener.canHandle( sessionId, req ) )
            {
                await listener.handle( sessionId, req, resp );
                break;
            }
        }
    }
}

module.exports = { mod: new Questrandomizer() }
