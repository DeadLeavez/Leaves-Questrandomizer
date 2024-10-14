import { DependencyContainer, Lifecycle } from "tsyringe";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HashUtil } from "@spt/utils/HashUtil";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";
import { LeavesUtils } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";


// ISSUES:
// GEAR U WEAR //Added to locale

class Questrandomizer implements IPreSptLoadMod
{
    private databaseServer: DatabaseServer;
    private hashUtil: HashUtil;
    private weightedRandomHelper: WeightedRandomHelper;
    private handbookHelper: HandbookHelper;

    private leavesUtils: LeavesUtils;
    private leavesQuestTools: LeavesQuestTools;
    private config: any;
    private weaponCategories: any;
    private weaponCategoriesWeighting: any;
    private gearList: any;
    private localizationChanges: any;
    private QuestDB: any;

    private bodyParts =
        [
            "Head",
            "Chest",
            "Stomach",
            "Arms",
            "Legs"
        ];
    private validTargets =
        [
            "AnyPmc",
            "Savage",
            "Any" //Maybe add USEC/BEAR distinguishing later.
        ];
    private targetNameTranslator =
        {
            "anypmc": "Any PMC",
            "savage": "Scavs",
            "any": "Anything",
            "marksman": "Sniper Scav",
            "assault": "Scav",
            "bossbully": "Reshala",
            "followerbully": "Reshala Follower",
            "bosskilla": "Killa",
            "bosskojaniy": "Shturman",
            "followerkojaniy": "Shturman Follower",
            "bossgluhar": "Gluhar",
            "followergluharassault": "Gl. Fol. Assault",
            "followergluharsecurity": "Gl. Fol. Security",
            "followergluharscout": "Gl. Fol. Scout",
            "followergluharsniper": "Gl. Fol. Snipe",
            "followersanitar": "Sanitar Follower",
            "bosssanitar": "Sanitar",
            "sectantwarrior": "Cultist Warrior",
            "sectantpreist": "Cultist Priest",
            "bosstagilla": "Tagilla",
            "followertagilla": "Tagilla Follower",
            "exusec": "Rogue",
            "bossknight": "Knight",
            "followerbigpipe": "Big Pipe",
            "followerbirdeye": "Birdeye",
            "bosszryachiy": "Zryachiy",
            "followerzryachiy": "Zryachiy Follower",
            "bossboar": "Kaban",
            "followerboar": "Kaban Follower",
            "bossboarsniper": "Kaban Sniper",
            "followerboarclose1": "Kaban Follower C.",
            "followerboarclose2": "Kaban Follower C.2",
            "bosskolontay": "Kolontay",
            "followerkolontayassault": "Kolontay F. Assault.",
            "followerkolontaysecurity": "Kolontay F. Security",
            "bossPARTISAN": "Partisan",
            "pmcbear": "Bear PMC",
            "pmcusec": "USEC PMC"

        }
    private mapNameTranslator =
        {
            "bigmap": "Customs",
            "factory4_day": "Factory - Day",
            "factory4_night": "Factory - Night",
            "interchange": "Interchange",
            "laboratory": "Labs",
            "lighthouse": "Lighthouse",
            "rezervbase": "Rezerv",
            "shoreline": "Shoreline",
            "tarkovstreets": "Streets of Tarkov",
            "woods": "Woods",
            "sandbox": "Ground Zero L",
            "sandbox_high": "Ground Zero H"
        };
    private validMaps =
        [
            "factory4_day",
            "factory4_night",
            "TarkovStreets",
            "bigmap",
            "Sandbox",
            "Interchange",
            "RezervBase",
            "Shoreline",
            "laboratory",
            "Woods",
            "Lighthouse"
        ];
    private locationIdMap = {
        "any": "any",
        "factory4_day": "55f2d3fd4bdc2d5f408b4567",
        "factory4_night": "59fc81d786f774390775787e",
        "bigmap": "56f40101d2720b2a4d8b45d6",
        "woods": "5704e3c2d2720bac5b8b4567",
        "shoreline": "5704e554d2720bac5b8b456e",
        "interchange": "5714dbc024597771384a510d",
        "lighthouse": "5704e4dad2720bb55b8b4567",
        "laboratory": "5b0fc42d86f7744a585f9105",
        "rezervbase": "5704e5fad2720bc05b8b4567",
        "tarkovstreets": "5714dc692459777137212e12",
        "sandbox": "653e6760052c01c1c805532f",
        "sandbox_high": "653e6760052c01c1c805532f"
    };

    private loadWeaponCategories()
    {
        //Load the file
        const categoriesConfig = this.leavesUtils.loadFile( "config/weaponcategories.jsonc" );
        this.weaponCategories = {};

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

    private getWeaponGroup( flags: any ): string[]
    {
        let group = this.weightedRandomHelper.getWeightedValue<string>( this.weaponCategoriesWeighting );
        flags.whatWeaponGroup = group;
        return this.weaponCategories[ group ];
    }

    public preSptLoad( container: DependencyContainer ): void
    {
        this.hashUtil = container.resolve<HashUtil>( "HashUtil" );
        this.weightedRandomHelper = container.resolve<WeightedRandomHelper>( "WeightedRandomHelper" );
        this.handbookHelper = container.resolve<HandbookHelper>( "HandbookHelper" );
        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );

        //Helper Classes
        container.register<LeavesUtils>( "LeavesUtils", LeavesUtils, { lifecycle: Lifecycle.Singleton } );
        this.leavesUtils = container.resolve<LeavesUtils>( "LeavesUtils" );

        this.leavesUtils.setOutputFolder( `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/` );
        const itemTierList = this.leavesUtils.loadFile( "config/itemtierlist.jsonc" );
        this.leavesUtils.setTierList( itemTierList );

        container.register<LeavesQuestTools>( "LeavesQuestTools", LeavesQuestTools, { lifecycle: Lifecycle.Singleton } );

        this.leavesQuestTools = container.resolve<LeavesQuestTools>( "LeavesQuestTools" );
        const questpoints = this.leavesUtils.loadFile( "config/questpoints.jsonc" );
        this.leavesQuestTools.setQuestPoints( questpoints );

        //Load data
        this.config = this.leavesUtils.loadFile( "config/config.jsonc" );
        this.gearList = this.leavesUtils.loadFile( "config/gearlist.jsonc" );



        //Process data
        this.loadWeaponCategories();
    }
    private generateWeaponCategorySheet()
    {
        let sheet = "";
        for ( const category in this.weaponCategories )
        {
            sheet += `[Category: ${ category }]\n-----------------------------\n`;
            for ( const weapon of this.weaponCategories[ category ] )
            {
                sheet += `\t${ this.leavesUtils.getLocale( this.config.targetLocale, weapon, " Name" ) }\n`;
            }
            sheet += "\n";
        }
        this.leavesUtils.saveFile( sheet, "quests/categories.txt", false);
    }

    private getEditedQuest( questID: string ): IQuest
    {
        if ( !this.QuestDB[ questID ] )
        {
            this.leavesUtils.printColor( `[Questrandomizer] Didn't find quest: ${ questID }, creating` )
            //Edit the quest

            this.QuestDB[ questID ] = this.editQuest( structuredClone( this.databaseServer.getTables().templates.quests[ questID ] ) );

            this.leavesUtils.printColor( `[Questrandomizer] ${ questID }, created` )
        }

        return this.QuestDB[ questID ];
    }

    private loadEditedQuests()
    {
        //Load saved quests
        this.QuestDB = this.leavesUtils.loadFile( "quests/generated.jsonc" )
        this.leavesUtils.printColor( `[Questrandomizer] Loaded quest bundle!` );


        //Load localization bundle
        this.localizationChanges = this.leavesUtils.loadFile( "quests/locale.jsonc" );

        //Load into database.
        for ( const change in this.localizationChanges )
        {
            this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ change ] = this.localizationChanges[ change ];
        }

        this.leavesUtils.printColor( `[Questrandomizer] Loaded localization bundle!` );
    }

    private saveEditedQuests()
    {
        this.leavesUtils.saveFile( this.QuestDB, "quests/generated.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved quest bundle!` )
        this.leavesUtils.saveFile( this.localizationChanges, "quests/locale.jsonc" );
        this.leavesUtils.printColor( `[Questrandomizer] Saved localization bundle!` )
    }

    public postDBLoad( container: DependencyContainer ): void
    {
        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        //Init questDB and load anything that might have been generated before.
        this.QuestDB = {};
        this.localizationChanges = {};

        this.loadEditedQuests();

        //Iterate the regular quest database see if any new quests are added.
        for ( const originalQuest in this.databaseServer.getTables().templates.quests )
        {
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
        //this.dataDump();
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
        if ( !this.leavesUtils.searchObject( "Kills", quest.conditions.AvailableForFinish ) && Math.random() < this.config.addKillObjectiveToQuestChance )
        {
            this.addKillObjectiveToQuest( quest );
        }

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
                //Skip if it has kill failstate?
                this.editCounterCreatorTask( task, hasKillsFailstate );
            }
            else if ( task.conditionType === "HandoverItem" )
            {
                this.purgeFindItemTasks( quest.conditions.AvailableForFinish );
                this.editHandoverItemTask( task );
            }
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
                    if ( this.config.findItemBlacklist.includes( item ) )
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

    private editHandoverItemTask( task: IQuestCondition )
    {
        const itemDB = this.databaseServer.getTables().templates.items;
        const originalItem = task.target[ 0 ];
        //Ignore quest items
        if ( itemDB[ originalItem ]._props.QuestItem )
        {
            return;
        }

        let newTarget = [];
        let tier = this.leavesUtils.getTierFromID( originalItem );
        if ( tier == -1 )
        {
            const cost = this.handbookHelper.getTemplatePrice( originalItem );
            tier = this.leavesUtils.getClosestTier( Math.round( cost / this.config.handoverItemUnknownItemValueDivider ) );
        }

        newTarget.push( this.leavesUtils.getRandomItemFromTier( tier ) );

        task.target = newTarget;

        const previousValue: number = task.value as number;
        task.value = this.leavesUtils.generateValueAdjustment( previousValue, this.config.adjustHandoverCountFactorsUpDown );
        const newLocale = this.generateHandoverItemLocale( task );
        this.editTaskLocale( task, newLocale );

    }

    private generateHandoverItemLocale( task: IQuestCondition )
    {
        let line = "Handover ";

        line += `${ task.value } amount of `;

        line += this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ `${ task.target[ 0 ] } Name` ];

        return line;
    }

    private editCounterCreatorTask( task: IQuestCondition, hasKillsFailstate: boolean )
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
            whatWeaponGroup: "",
            hasSavageRole: -1,
            hasKillFailstate: hasKillsFailstate ? 1 : -1,
            hasEquipment: -1
        }

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

        if ( flags.hasKills >= 0 && flags.hasKillFailstate < 0 )
        {
            //Add location to quest potentially.
            if ( flags.hasLocation === -1 && Math.random() < this.config.chanceToAddLocations )
            {
                this.addLocationToQuest( conditions, flags );
            }
            else if ( flags.hasLocation >= 0 ) //Edit location
            {
                this.editLocations( conditions[ flags.hasLocation ], flags )
            }

            if ( flags.hasLocation >= 0 )
            {
                //Check for GZ, and add the _high version to it. //MOVE THIS OUTSIDE
                if ( conditions[ flags.hasLocation ].target.includes( "sandbox" ) )
                {
                    ( conditions[ flags.hasLocation ].target as string[] ).push( "sandbox_high" );

                }

                //Save the locations to flags
                flags.whatLoctations = structuredClone( conditions[ flags.hasLocation ].target as string[] );
            }

            //Add gear
            if ( flags.hasEquipment < 0 && Math.random() < this.config.chanceToAddGear )
            {
                flags.hasEquipment = this.addGearToQuest( conditions );
            }

            //Edit zones possibly (PROBABLY WONT DO)
            if ( flags.hasInZone >= 0 )
            {

            }

            //We edit the kill quest
            this.editKillsDetails( conditions[ flags.hasKills ], flags );

            //edit KILL count if its not a special type
            if ( flags.hasSavageRole )
            {
                const previousValue: number = task.value as number;
                task.value = this.leavesUtils.generateValueAdjustment( previousValue, this.config.adjustKillCountFactorsUpDown );
            }

            const templocale = this.generateKillsLocale( task, flags )
            this.editTaskLocale( task, templocale );

        }
        //We don't edit anything else with counters for now.
        return;
    }
    private addGearToQuest( condition: IQuestConditionCounterCondition[] ): number
    {
        let gearPieces = this.leavesUtils.getUniqueWeightedValues<string>( this.gearList, this.config.addGearCount );
        let tempGear =
        {
            "IncludeNotEquippedItems": false,
            "conditionType": "Equipment",
            "dynamicLocale": false,
            "equipmentExclusive": [],
            "equipmentInclusive": [],
            "id": this.hashUtil.generate()
        };
        for ( const piece of gearPieces )
        {
            tempGear.equipmentInclusive.push( [ piece ] );
        }

        //return the index of the new entry
        return condition.push( tempGear ) - 1;
    }

    private editTaskLocale( task: IQuestCondition, templocale: string )
    {
        const taskid = task.id;
        this.localizationChanges[ taskid ] = templocale;
        this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ taskid ] = templocale;
        this.leavesUtils.printColor( templocale, LogTextColor.MAGENTA );
    }

    private addLocationToQuest( conditions: IQuestConditionCounterCondition[], flags: any )
    {
        let locationData =
        {
            "conditionType": "Location",
            "dynamicLocale": false,
            "id": this.hashUtil.generate(),
            "target": []
        }
        //Generate a random amount of new locations
        let mapCount = 1;

        //Add new maps to location
        locationData.target = this.leavesUtils.getUniqueValues( this.validMaps, mapCount );

        //Index will be the length minus 1
        flags.hasLocation = conditions.push( locationData ) - 1;
    }

    private addKillObjectiveToQuest( quest: IQuest )
    {
        //SPT, YOUR TYPES SUCK!
        let objectiveData: any =
        {
            "completeInSeconds": 0,
            "conditionType": "CounterCreator",
            "counter": {
                "conditions": [
                    {
                        "bodyPart": [],
                        "compareMethod": ">=",
                        "conditionType": "Kills",
                        "daytime": {
                            "from": 0,
                            "to": 0
                        },
                        "distance": {
                            "compareMethod": ">=",
                            "value": 0
                        },
                        "dynamicLocale": false,
                        "enemyEquipmentExclusive": [],
                        "enemyEquipmentInclusive": [],
                        "enemyHealthEffects": [],
                        "id": this.hashUtil.generate(),
                        "resetOnSessionEnd": false,
                        "savageRole": [],
                        "target": this.validTargets[ randomInt( this.validTargets.length ) ],
                        "value": 1,
                        "weapon": [],
                        "weaponCaliber": [],
                        "weaponModsExclusive": [],
                        "weaponModsInclusive": []
                    },
                    {
                        "conditionType": "Location",
                        "dynamicLocale": false,
                        "id": this.hashUtil.generate(),
                        "target": []
                    }
                ],
                "id": this.hashUtil.generate()
            },
            "doNotResetIfCounterCompleted": false,
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "id": this.hashUtil.generate(),
            "index": 0,
            "oneSessionOnly": false,
            "parentId": "",
            "type": "Elimination",
            "value": this.config.addKillObjectiveKillCount,
            "visibilityConditions": []
        };
        quest.conditions.AvailableForFinish.push( objectiveData );
    }

    private editLocations( locations: IQuestConditionCounterCondition, flags: any )
    {
        //If we have special enemies, we don't want to fuck with the location.
        if ( flags.hasSavageRole >= 0 )
        {
            return;
        }

        let mapCount = 1

        //Generate new map
        locations.target = this.leavesUtils.getUniqueValues( this.validMaps, mapCount );
    }

    private generateKillsLocale( task: IQuestCondition, flags: any ): string
    {
        const kills = task.value as number;
        const conditions = task.counter.conditions;
        let target: string = "";
        if ( flags.hasSavageRole >= 0 )
        {
            for ( let role of conditions[ flags.hasKills ].savageRole ) 
            {
                const targetTranslated = this.targetNameTranslator[ role.toLocaleLowerCase() ];
                target += `${ targetTranslated } `;
            }
        }
        else
        {
            target = conditions[ flags.hasKills ].target as string;
            target = this.targetNameTranslator[ target.toLocaleLowerCase() ] + " ";
        }



        let line: string = `Kill ${ kills } ${ target }`;

        //Distance
        if ( flags.hasDistance >= 0 )
        {
            const distance = conditions[ flags.hasKills ].distance.compareMethod as string + " " + conditions[ flags.hasKills ].distance.value as string;
            line += `at ${ distance }m `;
        }

        //Time of day //Skip if labs or factory
        if ( flags.hasTime >= 0 )
        {
            const start: string = ( conditions[ flags.hasKills ].daytime.from ).toString().padStart( 2, `0` );
            const finish: string = ( conditions[ flags.hasKills ].daytime.to ).toString().padStart( 2, `0` );
            line += `during ${ start }-${ finish } `;
        }

        //Weapon requirements
        if ( flags.hasWeapon >= 0 )
        {
            line += `using ${ flags.whatWeaponGroup } `;
        }

        //Body part hit requirement
        if ( flags.hasBodyparts >= 0 )
        {
            let bodypartsline = "in: ";
            for ( let partindex = 0; partindex < conditions[ flags.hasKills ].bodyPart.length; partindex++ )
            {
                bodypartsline += `${ conditions[ flags.hasKills ].bodyPart[ partindex ] } `
            }
            line += bodypartsline;
        }

        //Location
        if ( flags.hasLocation >= 0 )
        {
            let mapsline = "at ";
            for ( let mapsindex = 0; mapsindex < conditions[ flags.hasLocation ].target.length; mapsindex++ )
            {
                mapsline += `${ this.mapNameTranslator[ conditions[ flags.hasLocation ].target[ mapsindex ].toLowerCase() ] }`;

                //Check last line
                if ( mapsindex != conditions[ flags.hasLocation ].target.length - 1 )
                {
                    mapsline += ", ";
                }
                else
                {
                    mapsline += " ";
                }
            }
            line += mapsline;
        }

        //Gear
        if ( flags.hasEquipment >= 0 )
        {
            line += "wearing:\n";
            let tempCount = 0;
            for ( const gearGroup of conditions[ flags.hasEquipment ].equipmentInclusive )
            {
                line += "[";
                for ( const gearID of gearGroup )
                {
                    let name = this.leavesUtils.getLocale( this.config.targetLocale, gearID, " Name" );
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

        return line;
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
        if ( killsCondition.bodyPart && flags.hasSavageRole === -1 )
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
        if ( killsCondition.daytime )
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
                if ( Math.random() < this.config.chanceToAddTimeOfDay ) //And we add it by random chance.
                {
                    killsCondition.daytime.from = randomInt( 23 );
                    killsCondition.daytime.to = ( killsCondition.daytime.from + 6 ) % 24;
                    flags.hasTime = 1;
                }
            }
            else
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
            if ( flags.whatLoctations.includes( "factory4_day" ) || flags.whatLoctations.includes( "factory4_night" ) || flags.whatLoctations.includes( "laboratory" ) )
            {
                killsCondition.distance.compareMethod = ">=";
                killsCondition.distance.value = 0;
                flags.hasDistance = -1;
            }
            else if ( killsCondition.distance.value > 0 ) //If there is a range requirement
            {
                killsCondition.distance.compareMethod = randomInt( 2 ) > 0 ? ">=" : "<=";
                killsCondition.distance.value = ( randomInt( 8 ) + 2 ) * 10;
                flags.hasDistance = 1;
            }
            else if ( Math.random() < this.config.chanceToAddDistance ) //We add it by chance
            {
                killsCondition.distance.compareMethod = randomInt( 2 ) > 0 ? ">=" : "<=";
                killsCondition.distance.value = ( randomInt( 8 ) + 2 ) * 10;
                flags.hasDistance = 1;
            }
        }

        //Weapon
        if ( killsCondition.weapon )
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


}

module.exports = { mod: new Questrandomizer() }
