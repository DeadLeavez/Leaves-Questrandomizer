import { DependencyContainer, Lifecycle } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";

//Helpers
import { LeavesUtils, RTT_Colors } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesQuestGeneration } from "./LeavesQuestGeneration";

//item creation
import { CustomItemService } from "@spt/services/mod/CustomItemService";
import type { NewItemFromCloneDetails } from "@spt/models/spt/mod/NewItemDetails";
import { QuestStatus } from "@spt/models/enums/QuestStatus";

// TODO:
// Quest generation?
// Kill discrepancies between scavs/pmcs
// Locale to weapon categories?
// Randomize gear if its already there (NOT DONE)
// Have enemy be stunned?
// Forbid usage of meds?


class Questrandomizer implements IPreSptLoadMod
{
    private databaseServer: DatabaseServer;
    private weightedRandomHelper: WeightedRandomHelper;
    private handbookHelper: HandbookHelper;
    private customItemService: CustomItemService;

    private leavesUtils: LeavesUtils;
    private leavesQuestTools: LeavesQuestTools;
    private leavesQuestGeneration: LeavesQuestGeneration;
    private config: any;
    private weaponCategories: any;
    private handoverCategories: any;
    private weaponCategoriesWeighting: any;
    private gearList: any;
    private localizationChangesToSave: any;
    private QuestDB: any;

    private bodyParts: string[];
    private validTargets: string[];
    private validMaps: string[];
    private easyMaps: string[];
    private locationIdMap;

    private loadWeaponCategories()
    {
        //Load the file
        this.weaponCategories = this.leavesUtils.loadFile( "config/weaponcategories.jsonc" );

        //Load the weightings
        this.weaponCategoriesWeighting = {};
        for ( let category in this.weaponCategories.categories )
        {
            this.weaponCategoriesWeighting[ category ] = this.weaponCategories.categories[ category ].weight;
        }
    }

    private loadHandoverCategories()
    {
        //Load the file
        const categoriesConfig = this.leavesUtils.loadFile( "config/handovercategories.jsonc" );

        //Populate handover categories.
        this.handoverCategories = {};

        //Add the whitelist
        for ( const category of categoriesConfig.categoryWhitelist )
        {
            this.handoverCategories[ category ] = [];
        }

        //Add the custom lists
        for ( const customCategory in categoriesConfig.customCategories )
        {
            this.handoverCategories[ customCategory ] = categoriesConfig.customCategories[ customCategory ];
        }

        const itemDB = this.databaseServer.getTables().templates.items;

        //Get all items from categories
        for ( let item in itemDB )
        {
            //Check if its a bad item
            if ( !this.leavesUtils.isProperItem( item ) )
            {
                continue;
            }
            const itemObject = itemDB[ item ];
            if ( this.handoverCategories.hasOwnProperty( itemObject._parent ) )
            {
                this.handoverCategories[ itemObject._parent ].push( itemObject._id );
            }
        }

        //this.leavesUtils.debugJsonOutput( this.handoverCategories );
    }

    private setWeaponGroup( condition: IQuestConditionCounterCondition, flags: any )
    {
        //Check if were gonna use a category or specific weapon
        if ( Math.random() < this.config.chanceForSpecificWeapon )
        {
            const count = this.weaponCategories.specificWeapon.length;
            let weapon: string = this.weaponCategories.specificWeapon[ randomInt( count ) ];
            flags.hasSpecificWeapon = 1;
            flags.whatWeaponOrGroup = weapon;
            condition.weapon = [ weapon ];
            return;
        }
        let group = this.weightedRandomHelper.getWeightedValue<string>( this.weaponCategoriesWeighting );
        flags.whatWeaponOrGroup = group;
        const weaponGroup = this.weaponCategories.categories[ group ];
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
        if ( !this.weaponCategories.modCategories[ modGroup ] )
        {
            this.leavesUtils.printColor( `Tried to use missing weapon mod category ${ modGroup }`, LogTextColor.RED );
            return weaponModsCurrent;
        }

        const modCategory = this.weaponCategories.modCategories[ modGroup ];

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

    public preSptLoad( container: DependencyContainer ): void
    {
        this.weightedRandomHelper = container.resolve<WeightedRandomHelper>( "WeightedRandomHelper" );
        this.handbookHelper = container.resolve<HandbookHelper>( "HandbookHelper" );
        this.customItemService = container.resolve<CustomItemService>( "CustomItemService" );
        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );

        //Helper Classes
        container.register<LeavesUtils>( "LeavesUtils", LeavesUtils, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestTools>( "LeavesQuestTools", LeavesQuestTools, { lifecycle: Lifecycle.Singleton } );
        container.register<LeavesQuestGeneration>( "LeavesQuestGeneration", LeavesQuestGeneration, { lifecycle: Lifecycle.Singleton } );

        this.leavesUtils = container.resolve<LeavesUtils>( "LeavesUtils" );
        this.leavesQuestTools = container.resolve<LeavesQuestTools>( "LeavesQuestTools" );
        this.leavesQuestGeneration = container.resolve<LeavesQuestGeneration>( "LeavesQuestGeneration" );

        this.leavesUtils.setModFolder( `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/` );
        this.leavesUtils.setTierList( "config/itemtierlist.jsonc" );
        this.leavesUtils.loadIDs( "assets/generated/ids.jsonc" );

        const questpoints = this.leavesUtils.loadFile( "assets/data/questpoints.jsonc" );
        this.leavesQuestTools.setQuestPoints( questpoints );

        //Load data
        this.config = this.leavesUtils.loadFile( "config/config.jsonc" );
        this.gearList = this.leavesUtils.loadFile( "config/gearlist.jsonc" );

        const miscData = this.leavesUtils.loadFile( "assets/data/misc.jsonc" );
        this.locationIdMap = miscData.locationIdMap;
        this.validMaps = miscData.validMaps;
        this.validTargets = miscData.validTargets;
        this.bodyParts = miscData.bodyParts;
        this.easyMaps = miscData.easyMaps;

        //Process data
        this.leavesQuestGeneration.setConfig( this.config );
        this.loadWeaponCategories();
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
            newId: this.leavesUtils.getID( category ),
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

    private addToCategorySheet( weaponGroup: any, modcategory: string, localename: string, language: string )
    {
        let categorysheet = ``;

        if ( Object.keys( weaponGroup[ modcategory ] ).length > 0 )
        {
            categorysheet += this.leavesUtils.RTT_Size( `[${ this.leavesUtils.getLoc( localename, language ) }]`, "+4px" );
            categorysheet += `\n-----------------------------\n`;

            let firstDone = false;
            for ( const modgroup of Object.keys( weaponGroup[ modcategory ] ) )
            {
                if ( firstDone )
                {
                    categorysheet += weaponGroup[ modcategory ][ modgroup ] ? `\tAND\n` : `\tOR\n`;
                }
                categorysheet += `\t${ modgroup }\n`;
                firstDone = true;
            }
        }

        return categorysheet;
    }

    private generateWeaponCategorySheet()
    {
        //Generate the items
        for ( const category in this.weaponCategories.categories )
        {
            this.generateCategoryItem( category, this.leavesUtils.getID( "WeaponCategoryHandbookID" ) );
        }

        for ( const modGroup in this.weaponCategories.modCategories )
        {
            this.generateCategoryItem( modGroup, this.leavesUtils.getID( "ModCategoryHandbookID" ) );
        }

        //Create the files and generate locales
        for ( const language in this.databaseServer.getTables().locales.global )
        {
            let sheet = ""; //The whole file

            this.leavesUtils.addLocaleTo(
                language,
                this.leavesUtils.RTT_Color( this.leavesUtils.getLoc( "WeaponCategory", language ), RTT_Colors.GREEN ),
                this.leavesUtils.getID( "WeaponCategoryHandbookID" )
            );
            for ( const category in this.weaponCategories.categories )
            {
                const weaponGroup = this.weaponCategories.categories[ category ];

                //Add weapon list
                let categorysheet = this.leavesUtils.RTT_Size( `[${ this.leavesUtils.getLoc( "SheetCategory", language ) }: ${ category }]`, "+4px" );
                categorysheet += `\n-----------------------------\n`;
                if ( weaponGroup.weapons.length === 0 )
                {
                    categorysheet += `\t${ this.leavesUtils.getLoc( "AnyWeapon", language ) }\n`;
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

                const categoryID = this.leavesUtils.getID( category );
                this.leavesUtils.addFullLocale( language, category, category, categorysheet, categoryID );
                sheet += categorysheet;
            }

            sheet += `\n-----------------------------\n`;
            sheet += `-----------------------------\n`;

            this.leavesUtils.addLocaleTo(
                language,
                this.leavesUtils.RTT_Color( this.leavesUtils.getLoc( "ModCategory", language ), RTT_Colors.BLUE ),
                this.leavesUtils.getID( "ModCategoryHandbookID" ) );
            for ( const category in this.weaponCategories.modCategories )
            {
                const modGroup = this.weaponCategories.modCategories[ category ];

                //Top/Title
                let modGroupSheet = `\n[${ this.leavesUtils.getLoc( "SheetCategory", language ) }: ${ category }] - `;
                modGroupSheet += modGroup.together ? this.leavesUtils.getLoc( "AllRequired", language ) : this.leavesUtils.getLoc( "OneRequired", language );
                modGroupSheet = this.leavesUtils.RTT_Size( modGroupSheet, "+4px" );
                modGroupSheet += `\n-----------------------------\n`;

                //Add each mod
                for ( const mod of modGroup.mods )
                {
                    modGroupSheet += `\t${ this.leavesUtils.getLocale( language, mod, " Name" ) }\n`;
                }
                const categoryID = this.leavesUtils.getID( category );

                this.leavesUtils.addFullLocale( language, category, category, modGroupSheet, categoryID );

                sheet += modGroupSheet;
            }
            this.leavesUtils.saveFile( sheet, `categories/categories_${ language }.txt`, false );
        }
    }

    private getEditedQuest( questID: string ): IQuest
    {
        if ( !this.QuestDB[ questID ] )
        {
            this.leavesUtils.printColor( `[Questrandomizer] Didn't find quest: ${ questID }, creating` )
            //Edit the quest

            this.QuestDB[ questID ] = this.editQuest( structuredClone( this.databaseServer.getTables().templates.quests[ questID ] ) );

            //this.leavesUtils.printColor( `[Questrandomizer] ${ questID }, created` )
        }

        return this.QuestDB[ questID ];
    }

    private loadEditedQuests()
    {
        //Load saved quests
        this.QuestDB = this.leavesUtils.loadFile( "assets/generated/quests.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Loaded quest bundle!` );

        //Load localization bundle
        this.localizationChangesToSave = this.leavesUtils.loadFile( "assets/generated/locale.jsonc" );

        //Load into database.
        let localeDB = this.databaseServer.getTables().locales.global;
        for ( const language in this.localizationChangesToSave )
        {
            for ( const changeID in this.localizationChangesToSave[ language ] )
            {
                if ( !localeDB[ language ] )
                {
                    localeDB[ language ] = {};
                }
                localeDB[ language ][ changeID ] = this.localizationChangesToSave[ language ][ changeID ];
            }
        }

        this.leavesUtils.printColor( `[Questrandomizer] Loaded localization bundle!` );
    }

    private saveEditedQuests()
    {
        this.leavesUtils.saveFile( this.QuestDB, "assets/generated/quests.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved quest bundle!` )
        this.leavesUtils.saveFile( this.localizationChangesToSave, "assets/generated/locale.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved localization bundle!` )
    }

    public postDBLoad( container: DependencyContainer ): void
    {
        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        //Init questDB and load anything that might have been generated before.
        this.QuestDB = {};
        this.localizationChangesToSave = {};
        this.leavesUtils.loadLocalization( "assets/data/localization" );
        this.loadEditedQuests();
        this.loadHandoverCategories();

        //Set up handbook categories
        this.setupHandbookCategories();


        let questWhitelist: string[] = [];
        if ( this.config.enableQuestWhilelist )
        {
            questWhitelist = this.leavesUtils.loadFile( "config/questwhitelist.jsonc" ).whitelist;
        }

        //Iterate the regular quest database see if any new quests are added.
        const serverQuestDB = this.databaseServer.getTables().templates.quests;
        for ( const originalQuest in serverQuestDB )
        {
            //Check whitelist.
            if ( !questWhitelist.includes( originalQuest ) && this.config.enableQuestWhilelist )
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
        this.databaseServer.getTables().templates.quests = this.QuestDB;

        //Save them to file. NOT SAVING UNTIL IT WORKS BETTER
        this.saveEditedQuests();

        //Generate a category list
        this.generateWeaponCategorySheet();

        this.leavesUtils.saveIDs( "assets/generated/ids.jsonc" );
        this.leavesUtils.dataDump();
    }

    private setupHandbookCategories()
    {
        let handbookDB = this.databaseServer.getTables().templates.handbook;

        const questrandomizerCategory = {
            "Id": this.leavesUtils.getID( "TopLevelHandbookCategory" ),
            "ParentId": null,
            "Icon": "/files/handbook/icon_barter_valuables.png", //Make my own icon?
            "Color": "",
            "Order": "14"
        };
        //Weapon categories
        const weaponCategory = {
            "Id": this.leavesUtils.getID( "WeaponCategoryHandbookID" ),
            "ParentId": this.leavesUtils.getID( "TopLevelHandbookCategory" ),
            "Icon": "/files/handbook/icon_weapons_pistols.png", //Make my own icon?
            "Color": "",
            "Order": "2"
        };
        //Mod categories
        const modCategory = {
            "Id": this.leavesUtils.getID( "ModCategoryHandbookID" ),
            "ParentId": this.leavesUtils.getID( "TopLevelHandbookCategory" ),
            "Icon": "/files/handbook/icon_barter_tools.png", //Make my own icon?
            "Color": "",
            "Order": "1"
        };

        this.leavesUtils.addLocaleToAll( `${ this.leavesUtils.RTT_Rainbowify( "[Questrandomizer]" ) }`, questrandomizerCategory.Id );

        handbookDB.Categories.push( questrandomizerCategory );
        handbookDB.Categories.push( weaponCategory );
        handbookDB.Categories.push( modCategory );
    }

    private editQuest( quest: IQuest ): IQuest
    {
        //QUEST — There is only one quest
        //- TASK  — There can be multiple tasks.
        //- - CONDITIONS — There can be many parts to conditions

        if ( this.config.questBlacklist.includes( quest._id ) )
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
        if ( !this.leavesUtils.searchObject( "Kills", quest.conditions.AvailableForFinish ) && Math.random() < this.config.addKillObjectiveToQuestChance && !hasKillsFailstate )
        {
            const tempTarget = this.validTargets[ randomInt( this.validTargets.length ) ];
            const tempKillcount = this.config.addKillObjectiveKillCount;
            this.leavesQuestTools.addKillObjectiveToQuest( quest, tempTarget, tempKillcount );
            this.leavesUtils.printColor( "Added Kill objective to quest", LogTextColor.YELLOW );
        }
        let editHandOverOverride = false;
        if ( !this.leavesUtils.searchObject( "HandoverItem", quest.conditions.AvailableForFinish ) && Math.random() < this.config.addHandOverObjectiveToQuestChance )
        {
            this.leavesQuestTools.addHandOverObjectiveToQuest( quest, this.config.addHandOverObjectiveBaseCount );
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
        quest.location = this.locationIdMap[ this.leavesQuestTools.getQuestLocationText( quest ).toLocaleLowerCase() ];

        return quest;
    }

    private editHandoverItemTask( task: IQuestCondition, IgnoreChance: boolean ): boolean
    {
        //Chance to even do this.
        if ( Math.random() > this.config.chanceToEditHandoverCondition || !IgnoreChance )
        {
            return false;
        }

        const itemDB = this.databaseServer.getTables().templates.items;
        const originalItem = task.target[ 0 ];
        //Ignore quest items
        if ( itemDB[ originalItem ]._props.QuestItem )
        {
            return false;
        }

        //Item blacklist
        const originalItemParent = itemDB[ originalItem ]._parent;
        if ( this.config.handoverItemBlacklist.includes( originalItem ) || this.config.handoverItemBlacklist.includes( originalItemParent ) )
        {
            return false;
        }

        let newTarget = [];
        let categoryName = "";

        if ( Math.random() < this.config.chanceToRequireItemCategory ) //Category
        {
            const keys = Object.keys( this.handoverCategories );
            const category = keys[ randomInt( keys.length ) ];
            newTarget = this.handoverCategories[ category ];
            categoryName = category;

            //Increase item handover count
            task.value = task.value as number * this.config.itemCategoryMultiplier;
        }
        else //Single item
        {
            let tier = this.leavesUtils.getTierFromID( originalItem );
            if ( tier == -1 )
            {
                const cost = this.handbookHelper.getTemplatePrice( originalItem );
                tier = this.leavesUtils.getClosestTier( Math.round( cost / this.config.handoverItemUnknownItemValueDivider ) );
            }

            newTarget.push( this.leavesUtils.getRandomItemFromTier( tier ) );
        }

        task.target = newTarget;


        //Found in raid.
        if ( Math.random() < this.config.chanceHandoverNeedsFIR )
        {
            task.onlyFoundInRaid = true;
        }

        //Remove gear condition
        task.maxDurability = 100;
        task.minDurability = 0;

        //Strip visibilityConditions
        task.visibilityConditions = [];

        const previousValue: number = task.value as number;
        task.value = this.leavesUtils.generateValueAdjustment( previousValue, this.config.adjustHandoverCountFactorsUpDown );

        this.leavesQuestTools.generateHandoverItemLocale( task, categoryName, this.localizationChangesToSave );

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
        }

        //Check if its on the list of "easy" quests
        flags.isEasyQuest = this.config.easierQuestList.includes( flags.questID );

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
                flags.hasInZone = counterConditionIndex;
            }
            else if ( conditions[ counterConditionIndex ].conditionType === "Equipment" )
            {
                flags.hasEquipment = counterConditionIndex;
            }
        }

        //Edit kill quests
        if ( flags.hasKills >= 0 && flags.hasKillFailstate < 0 && Math.random() < this.config.chanceToEditKillConditions )
        {

            //Add location to quest potentially.
            if ( flags.hasLocation === -1 && Math.random() < this.config.chanceToAddLocations && flags.hasSavageRole < 0 )
            {
                const tempMaps: string[] = this.leavesUtils.getUniqueValues<string>( this.validMaps, this.config.locationCount );
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
            if ( flags.hasEquipment < 0 && Math.random() < this.config.chanceToAddGear && !flags.isEasyQuest )
            {
                const tempGearPieces = this.leavesUtils.getUniqueWeightedValues<string>( this.gearList, this.config.addGearCount );
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
                const previousValue: number = task.value as number;
                task.value = this.leavesUtils.generateValueAdjustment( previousValue, this.config.adjustKillCountFactorsUpDown );
            }

            this.leavesQuestTools.generateKillsLocale( task, flags, this.localizationChangesToSave )
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
            locations.target = this.leavesUtils.getUniqueValues( this.easyMaps, mapCount );
        }
        else //Else we just use any map.
        {
            //this.leavesUtils.printColor( `Using hard map for this quest. QUID: ${flags.questID}` );
            locations.target = this.leavesUtils.getUniqueValues( this.validMaps, mapCount );
        }
    }

    private editKillsDetails( killsCondition: IQuestConditionCounterCondition, flags: any )
    {

        //Target
        if ( this.validTargets.includes( killsCondition.target as string ) )
        {
            if ( killsCondition.savageRole?.length > 0 )
            {
                flags.hasSavageRole = 1;
            }
            else
            {
                killsCondition.target = this.validTargets.at( randomInt( this.validTargets.length - 1 ) );
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
            else if ( Math.random() < this.config.chanceToAddBodypart )
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
                if ( Math.random() < this.config.chanceToAddTimeOfDay && !flags.isEasyQuest ) //And we add it by random chance.
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
            else if ( Math.random() < this.config.chanceToAddDistance ) //We add it by chance
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
            else if ( Math.random() < this.config.chanceToAddWeapon )
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
        let tempArray = this.leavesUtils.getUniqueValues( this.bodyParts, count );
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
}

module.exports = { mod: new Questrandomizer() }
