import { DependencyContainer, Lifecycle } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";
import { LeavesUtils } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { HashUtil } from "@spt/utils/HashUtil";

// TODO:
// Locale to weapon categories?
// Weapon Category Mods? / Restructure Weapon categories (HALF DONE)
// Category Items at a vendor perhaps?
// Randomize gear if its already there (NOT DONE)
// Have enemy be stunned?
// Forbid usage of meds?


class Questrandomizer implements IPreSptLoadMod
{
    private databaseServer: DatabaseServer;
    private weightedRandomHelper: WeightedRandomHelper;
    private handbookHelper: HandbookHelper;
    private hashUtil: HashUtil;

    private leavesUtils: LeavesUtils;
    private leavesQuestTools: LeavesQuestTools;
    private config: any;
    private weaponCategories: any;
    private handoverCategories: any;
    private weaponIndividualWeapons: string[];
    private weaponCategoriesWeighting: any;
    private gearList: any;
    private localizationChanges: any;
    private localization: any;
    private QuestDB: any;

    private bodyParts: string[];
    private validTargets: string[];
    private validMaps: string[];
    private easyMaps: string[];
    private locationIdMap;
    private targetLocales: Set<string>;

    private loadWeaponCategories()
    {
        //Load the file
        const categoriesConfig = this.leavesUtils.loadFile( "config/weaponcategories.jsonc" );
        this.weaponCategories = {};


        //Load the individualWeapons
        this.weaponIndividualWeapons = categoriesConfig.SpecificWeapon;

        //Load the weightings
        this.weaponCategoriesWeighting = categoriesConfig.weightings;
        for ( let weighting in this.weaponCategoriesWeighting )
        {
            this.weaponCategories[ weighting ] = [];
        }

        //Process all weapons into their categories to be easier to use.
        for ( const weapon in categoriesConfig.weapons )
        {
            for ( const category of categoriesConfig.weapons[ weapon ] )
            {
                if ( this.weaponCategories[ category ] )
                {
                    this.weaponCategories[ category ].push( weapon );
                }
                else
                {
                    this.leavesUtils.printColor( `Weapon ${ weapon } is trying to add to ${ category }, but it doesn't exist` )
                }
            }
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

    private getWeaponGroup( flags: any ): string[]
    {
        //Check if were gonna use a category or specific weapon
        if ( Math.random() < this.config.chanceForSpecificWeapon )
        {
            const count = this.weaponIndividualWeapons.length;
            let weapon: string = this.weaponIndividualWeapons[ randomInt( count ) ];
            flags.hasSpecificWeapon = 1;
            flags.whatWeaponOrGroup = weapon;
            return [ weapon ];
        }
        let group = this.weightedRandomHelper.getWeightedValue<string>( this.weaponCategoriesWeighting );
        flags.whatWeaponOrGroup = group;
        return this.weaponCategories[ group ];
    }

    private loadLocalization()
    {
        this.localization = [];
        //Turn this into a loop. Thats it.
        for ( const file of this.leavesUtils.getFilesInFolder( "assets/data/localization/" ) )
        {
            const fileWithoutExtension = file.split( '.' )[ 0 ];
            //this.leavesUtils.printColor( fileWithoutExtension );
            this.localization[ fileWithoutExtension ] = this.leavesUtils.loadFile( `assets/data/localization/${ file }` );
        }


    }

    public preSptLoad( container: DependencyContainer ): void
    {
        this.weightedRandomHelper = container.resolve<WeightedRandomHelper>( "WeightedRandomHelper" );
        this.handbookHelper = container.resolve<HandbookHelper>( "HandbookHelper" );
        this.hashUtil = container.resolve<HashUtil>( "HashUtil" );
        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );

        //Helper Classes
        container.register<LeavesUtils>( "LeavesUtils", LeavesUtils, { lifecycle: Lifecycle.Singleton } );
        this.leavesUtils = container.resolve<LeavesUtils>( "LeavesUtils" );

        this.leavesUtils.setModFolder( `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/` );
        const itemTierList = this.leavesUtils.loadFile( "config/itemtierlist.jsonc" );
        this.leavesUtils.setTierList( itemTierList );

        container.register<LeavesQuestTools>( "LeavesQuestTools", LeavesQuestTools, { lifecycle: Lifecycle.Singleton } );

        this.leavesQuestTools = container.resolve<LeavesQuestTools>( "LeavesQuestTools" );
        const questpoints = this.leavesUtils.loadFile( "assets/data/questpoints.jsonc" );
        this.leavesQuestTools.setQuestPoints( questpoints );

        //Load data
        this.config = this.leavesUtils.loadFile( "config/config.jsonc" );
        this.gearList = this.leavesUtils.loadFile( "config/gearlist.jsonc" );

        this.loadLocalization();

        const miscData = this.leavesUtils.loadFile( "assets/data/misc.jsonc" );
        this.locationIdMap = miscData.locationIdMap;
        this.validMaps = miscData.validMaps;
        this.validTargets = miscData.validTargets;
        this.bodyParts = miscData.bodyParts;
        this.easyMaps = miscData.easyMaps;

        //Process data
        this.loadWeaponCategories();
    }

    private generateWeaponCategorySheet()
    {
        for ( const language in this.databaseServer.getTables().locales.global )
        {
            let sheet = "";
            for ( const category in this.weaponCategories )
            {
                sheet += `[${ this.getLoc( "Category", language ) }: ${ category }]\n-----------------------------\n`;
                for ( const weapon of this.weaponCategories[ category ] )
                {
                    sheet += `\t${ this.leavesUtils.getLocale( language, weapon, " Name" ) }\n`;
                }
                sheet += "\n";
            }
            this.leavesUtils.saveFile( sheet, `categories/categories_${ language }.txt`, false );
        }
        //Debug shit
        /*if ( true )
        {

            let sheet = "";
            for ( const category in this.weaponCategories )
            {
                sheet += `"${ category }":\n{\n\t"weight":${ this.weaponCategoriesWeighting[ category ] },\n"weapons":\n[\n`;
                for ( const weapon of this.weaponCategories[ category ] )
                {
                    let last = false;
                    if ( weapon == this.weaponCategories[ category ][ this.weaponCategories[ category ].length - 1 ] )
                    {
                        last = true;
                    }
                    sheet += `"${ weapon }"${ last ? `` : `,` }//${ this.leavesUtils.getLocale( "en", weapon, " Name" ) }\n`;
                }
                sheet += `\t\n],\n"mods-inclusive":
                        [
                        ],
                        "mods-exclusive":
                        [
                        ]\n},\n`;
            }
            this.leavesUtils.saveFile( sheet, `categories/categories_temp.txt`, false );

        }*/
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
        this.localizationChanges = this.leavesUtils.loadFile( "assets/generated/locale.jsonc" );

        //Load into database.
        let localeDB = this.databaseServer.getTables().locales.global;
        for ( const language in this.localizationChanges )
        {
            //this.leavesUtils.debugJsonOutput( this.localizationChanges );
            //this.leavesUtils.printColor( `Language:${ language }` );
            for ( const changeID in this.localizationChanges[ language ] )
            {
                if ( !localeDB[ language ] )
                {
                    localeDB[ language ] = {};
                }
                localeDB[ language ][ changeID ] = this.localizationChanges[ language ][ changeID ];
            }
        }

        this.leavesUtils.printColor( `[Questrandomizer] Loaded localization bundle!` );
    }

    private saveEditedQuests()
    {
        this.leavesUtils.saveFile( this.QuestDB, "assets/generated/quests.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved quest bundle!` )
        this.leavesUtils.saveFile( this.localizationChanges, "assets/generated/locale.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved localization bundle!` )
    }

    public postDBLoad( container: DependencyContainer ): void
    {
        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        //Init questDB and load anything that might have been generated before.
        this.QuestDB = {};
        this.localizationChanges = {};
        this.loadEditedQuests();
        this.loadHandoverCategories();

        //Set up locale system.
        this.targetLocales = new Set<string>();
        for ( const locale in this.localization )
        {
            this.targetLocales.add( locale );
        }
        for ( const language in this.databaseServer.getTables().locales.global )
        {
            this.targetLocales.add( language );
        }


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
        //this.leavesUtils.dataDump();

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
            this.purgeFindItemTasks( quest.conditions.AvailableForFinish );
        }

        //Edit quest location
        quest.location = this.locationIdMap[ this.leavesQuestTools.getQuestLocationText( quest ).toLocaleLowerCase() ];

        return quest;
    }

    private purgeFindItemTasks( tasks: IQuestCondition[] )
    {
        const itemDB = this.databaseServer.getTables().templates.items;
        let toPurge = [];
        for ( let i = 0; i < tasks.length; i++ )
        {
            //Find "FindItem" tasks
            if ( tasks[ i ].conditionType === "FindItem" )
            {
                let purge = true;
                for ( const item of tasks[ i ].target )
                {
                    if ( itemDB[ item ]._props.QuestItem )
                    {
                        purge = false;
                    }
                }
                if ( purge )
                {
                    //We unshift (reverse push) so we get a reversed order to purge. To easier purge later.
                    toPurge.unshift( i );
                }
            }
        }
        for ( const purgeIndex of toPurge )
        {
            tasks.splice( purgeIndex, 1 );
        }
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

        this.generateHandoverItemLocale( task, categoryName );

        return true;
    }

    private generateHandoverItemLocale( task: IQuestCondition, categoryName: string )
    {
        for ( const targetLocale of this.targetLocales )
        {
            let line = `${ this.getLoc( "HandoverItem", targetLocale ) } `; //Hand over
            line += `${ task.value } ${ this.getLoc( "ofItem", targetLocale ) } `; //x counts of
            //No category
            if ( categoryName === "" )
            {
                line += this.leavesUtils.getLocale( targetLocale, task.target[ 0 ], ` Name` );
            }
            else //We have a category
            {
                //Get category name.

                //Try the official DB
                let newName = this.leavesUtils.getLocale( targetLocale, categoryName, " Name" );

                //Else we check the local DB
                if ( newName == null )
                {
                    newName = this.getLoc( `ITEMCATEGORY_${ categoryName }`, targetLocale );
                }

                //If the local DB fails, we use the category name, as is.
                if ( newName == null )
                {
                    newName = categoryName;
                }

                line += `${ this.getLoc( "itemsFromThe", targetLocale ) } ` // items from the
                line += `${ newName } `;
                line += `${ this.getLoc( "Category", targetLocale ) }` // category
            }

            this.editTaskLocale( task, line, targetLocale );
        }
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

            this.generateKillsLocale( task, flags )
        }
        //We don't edit anything else with counters for now.
        return;
    }

    private editTaskLocale( task: IQuestCondition, newLocale: string, targetLocale: string )
    {

        const taskId = task.id;
        if ( !this.localizationChanges[ targetLocale ] )
        {
            this.localizationChanges[ targetLocale ] = {};
        }
        this.localizationChanges[ targetLocale ][ taskId ] = newLocale;
        if ( !this.databaseServer.getTables().locales.global[ targetLocale ] )
        {
            this.databaseServer.getTables().locales.global[ targetLocale ] = {};
        }
        this.databaseServer.getTables().locales.global[ targetLocale ][ taskId ] = newLocale;

        if ( targetLocale === "en" )
        {
            this.leavesUtils.printColor( newLocale, LogTextColor.MAGENTA );
        }
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

    private getLoc( original: string, targetLocale ): string
    {
        if ( this.localization[ targetLocale ] && this.localization[ targetLocale ][ original ] )
        {
            return this.localization[ targetLocale ][ original ];
        }
        else
        {
            return this.localization[ "en" ][ original ];
        }
    }

    private generateKillsLocale( task: IQuestCondition, flags: any )
    {
        for ( const targetLocale of this.targetLocales )
        {

            const kills = task.value as number;
            const conditions = task.counter.conditions;
            let target: string = "";
            if ( flags.hasSavageRole >= 0 )
            {
                for ( let role of conditions[ flags.hasKills ].savageRole ) 
                {
                    const targetTranslated = this.getLoc( role.toLocaleLowerCase(), targetLocale );
                    target += `${ targetTranslated } `;
                }
            }
            else
            {
                target = conditions[ flags.hasKills ].target as string;
                target = this.getLoc( target.toLocaleLowerCase(), targetLocale ) + " ";
            }



            let line: string = `${ this.getLoc( "Kill", targetLocale ) } ${ kills } ${ target }`;

            //Distance
            if ( flags.hasDistance >= 0 )
            {
                const distance = conditions[ flags.hasKills ].distance.compareMethod as string + " " + conditions[ flags.hasKills ].distance.value as string;
                line += `${ this.getLoc( "AtDistance", targetLocale ) } ${ distance }m `;
            }

            //Time of day //Skip if labs or factory
            if ( flags.hasTime >= 0 )
            {
                const start: string = ( conditions[ flags.hasKills ].daytime.from ).toString().padStart( 2, `0` );
                const finish: string = ( conditions[ flags.hasKills ].daytime.to ).toString().padStart( 2, `0` );
                line += `${ this.getLoc( "DuringTimeOfDay", targetLocale ) } ${ start }-${ finish } `;
            }

            //Weapon requirements
            if ( flags.hasWeapon >= 0 )
            {
                line += `${ this.getLoc( "usingWeaponGroup", targetLocale ) } `;
                if ( flags.hasSpecificWeapon >= 0 )
                {
                    line += `${ this.leavesUtils.getLocale( targetLocale, flags.whatWeaponOrGroup, " Name" ) } `;
                }
                else
                {
                    line += `${ flags.whatWeaponOrGroup } `;
                }
            }

            //Body part hit requirement
            if ( flags.hasBodyparts >= 0 )
            {
                let bodypartsline = `${ this.getLoc( "inBodyPart", targetLocale ) }: `;
                //for ( let partindex = 0; partindex < conditions[ flags.hasKills ].bodyPart.length; partindex++ )
                for ( const bodyPart of conditions[ flags.hasKills ].bodyPart )
                {
                    bodypartsline += `${ this.getLoc( bodyPart, targetLocale ) } `
                }
                line += bodypartsline;
            }

            //Location
            if ( flags.hasLocation >= 0 )
            {
                let hasAddedGz = false;
                let mapsline = `${ this.getLoc( "atLocation", targetLocale ) } `;
                for ( const map of conditions[ flags.hasLocation ].target )
                {
                    if ( map.toLowerCase() === "sandbox" || map.toLowerCase() === "sandbox_high" )
                    {
                        if ( !hasAddedGz )
                        {
                            mapsline += `${ this.getLoc( "sandbox", targetLocale ) } `;
                            hasAddedGz = true;
                        }
                    }
                    else
                    {
                        mapsline += `${ this.getLoc( map.toLowerCase(), targetLocale ) } `;
                    }
                }
                line += mapsline;
            }

            //Gear
            if ( flags.hasEquipment >= 0 )
            {
                line += `${ this.getLoc( "wearingGear", targetLocale ) }:\n`;
                let tempCount = 0;
                for ( const gearGroup of conditions[ flags.hasEquipment ].equipmentInclusive )
                {
                    line += "[";
                    for ( const gearID of gearGroup )
                    {
                        let name = this.leavesUtils.getLocale( targetLocale, gearID, " Name" );
                        line += `${ name }`;
                    }
                    line += "]";

                    //Check if we're on the last line, so to not add extra |
                    if ( tempCount < conditions.length - 1 )
                    {
                        line += "|"
                    }
                    else
                    {
                        line += " ";
                    }

                    tempCount++;
                }
            }

            this.editTaskLocale( task, line, targetLocale );
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
                killsCondition.weapon = this.getWeaponGroup( flags );
            }
            else if ( Math.random() < this.config.chanceToAddWeapon )
            {
                flags.hasWeapon = 1;
                killsCondition.weapon = this.getWeaponGroup( flags );
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

    private add( item: string, target: any )
    {
        let order: string[] = [];
        let current = item;
        const finalParent = this.databaseServer.getTables().templates.items[ item ]._parent;

        //Generate order
        do
        {
            current = this.databaseServer.getTables().templates.items[ current ]._parent;
            if ( current === "" )
            {
                break;
            }
            order.unshift( current );
        } while ( current != "" );

        //Re-generate the stack
        let tempTarget = target;
        for ( const toCheck of order )
        {
            if ( toCheck === finalParent )
            {
                if ( !tempTarget[ toCheck ] )
                {
                    tempTarget[ toCheck ] = {};
                }
                tempTarget[ toCheck ][ item ] = `${ this.leavesUtils.getLocale( "en", item, " Name" ) }`;
            }
            if ( !tempTarget[ toCheck ] )
            {
                tempTarget[ toCheck ] = {};
            }

            tempTarget = tempTarget[ toCheck ];
        }

        //this.leavesUtils.debugJsonOutput( target )*/

        const itemDB = this.databaseServer.getTables().templates.items;
        let parentName = this.leavesUtils.getLocale( "en", itemDB[ item ]._parent, " Name" );
        if ( !target[ parentName ] )
        {
            target[ parentName ] = {};
        }
        target[ parentName ][ item ] = `${ this.leavesUtils.getLocale( "en", item, " Name" ) }`;
    }
}

module.exports = { mod: new Questrandomizer() }
