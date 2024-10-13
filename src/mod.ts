import { DependencyContainer } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { jsonc } from "jsonc";
import * as path from "node:path";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HashUtil } from "@spt/utils/HashUtil";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";


// ISSUES:
// GEAR U WEAR //At least add to locale

class Questrandomizer implements IPreSptLoadMod
{

    private logger: ILogger;
    private databaseServer: DatabaseServer;
    private jsonUtil: JsonUtil;
    private hashUtil: HashUtil;
    private vfs: VFS;
    private outputFolder: string;
    private weightedRandomHelper: WeightedRandomHelper;
    private handbookHelper: HandbookHelper;

    private config: any;
    private weaponCategories: any;
    private weaponCategoriesWeighting: any;
    private questpoints: any;
    private itemCategories: any;
    private itemTiers: number[];
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
            "bigmap",
            "factory4_day",
            "factory4_night",
            "interchange",
            "laboratory",
            "lighthouse",
            "rezervbase",
            "shoreline",
            "tarkovstreets",
            "woods",
            "sandbox"
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


    private loadFile( file: string ): any
    {
        const directoryFile = path.resolve( __dirname, `../${ file }` );
        return jsonc.parse( this.vfs.readFile( directoryFile ) );
    }

    private saveFile( data: any, file: string )
    {
        const serialized = this.jsonUtil.serialize( data, true );
        this.printColor( `${ this.outputFolder }${ file }` );
        this.vfs.writeFile( `${ this.outputFolder }${ file }`, serialized );
    }

    private loadWeaponCategories()
    {
        //Load the file
        const categoriesConfig = this.loadFile( "config/weaponcategories.jsonc" );
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
                    this.printColor( `Weapon ${ weapon } is trying to add to ${ category }, but it doesn't exist` )
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
        this.logger = container.resolve<ILogger>( "WinstonLogger" );
        this.jsonUtil = container.resolve<JsonUtil>( "JsonUtil" );
        this.hashUtil = container.resolve<HashUtil>( "HashUtil" );
        this.vfs = container.resolve<VFS>( "VFS" );
        this.weightedRandomHelper = container.resolve<WeightedRandomHelper>( "WeightedRandomHelper" );
        this.handbookHelper = container.resolve<HandbookHelper>( "HandbookHelper" );

        this.config = this.loadFile( "config/config.jsonc" );
        this.questpoints = this.loadFile( "config/questpoints.jsonc" );
        this.itemCategories = this.loadFile( "config/itemcategories.jsonc" );
        this.generateItemTiers();

        this.loadWeaponCategories();

        const preSptModLoader = container.resolve<PreSptModLoader>( "PreSptModLoader" );
        this.outputFolder = `${ preSptModLoader.getModPath( "leaves-Questrandomizer" ) }/`;
    }

    private generateItemTiers()
    {
        this.itemTiers = [];
        for ( const tier in this.itemCategories )
        {
            this.itemTiers.push( Number( tier ) );
        }
    }

    private getEditedQuest( questID: string ): IQuest
    {
        if ( !this.QuestDB[ questID ] )
        {
            this.printColor( `[Questrandomizer] Didn't find quest: ${ questID }, creating` )
            //Edit the quest

            this.QuestDB[ questID ] = this.editQuest( structuredClone( this.databaseServer.getTables().templates.quests[ questID ] ) );

            this.printColor( `[Questrandomizer] ${ questID }, created` )
        }

        return this.QuestDB[ questID ];
    }

    private loadEditedQuests()
    {
        //Load saved quests
        this.QuestDB = this.loadFile( "quests/generated.jsonc" )
        this.printColor( `[Questrandomizer] Loaded quest bundle!` );


        //Load localization bundle
        this.localizationChanges = this.loadFile( "quests/locale.jsonc" );

        //Load into database.
        for ( const change in this.localizationChanges )
        {
            this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ change ] = this.localizationChanges[ change ];
        }

        this.printColor( `[Questrandomizer] Loaded localization bundle!` );
    }

    private saveEditedQuests()
    {
        this.saveFile( this.QuestDB, "quests/generated.jsonc" );
        this.printColor( `[Questrandomizer] Saved quest bundle!` )
        this.saveFile( this.localizationChanges, "quests/locale.jsonc" );
        this.printColor( `[Questrandomizer] Saved localization bundle!` )
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
            hasKillsFailstate = this.checkForSubconditionType( "Kills", quest.conditions.Fail );
        }

        //Check if quest has kill type
        if ( !this.checkForSubconditionType( "Kills", quest.conditions.AvailableForFinish ) && Math.random() < this.config.addKillObjectiveToQuestChance )
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
        quest.location = this.locationIdMap[ this.getQuestLocationText( quest ).toLocaleLowerCase() ];

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
        let tier = this.findItemCategoryTier( originalItem );
        if ( tier == -1 )
        {
            const cost = this.handbookHelper.getTemplatePrice( originalItem );
            tier = this.getClosestTier( Math.round( cost / this.config.handoverItemUnknownItemValueDivider ) );
        }

        newTarget.push( this.getRandomItemFromTier( tier ) );

        task.target = newTarget;

        const previousValue: number = task.value as number;
        task.value = this.generateValueAdjustment( previousValue, this.config.adjustHandoverCountFactorsUpDown );
        const newLocale = this.generateHandoverItemLocale( task );
        this.editTaskLocale( task, newLocale );

    }

    private generateValueAdjustment( previousValue: number, factors: number[] ): number
    {
        const multiplier = 1 + ( Math.random() * factors[ 0 ] - Math.random() * factors[ 1 ] );
        const newValue = Math.round( previousValue * multiplier );
        if ( newValue < 1 )
        {
            return 1;
        }
        return newValue;
    }

    private generateHandoverItemLocale( task: IQuestCondition )
    {
        let line = "Handover ";

        line += `${ task.value } amount of `;

        line += this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ `${ task.target[ 0 ] } Name` ];

        return line;
    }

    private getRandomItemFromTier( tier: number ): string
    {
        let size = this.itemCategories[ tier ].length;

        return this.itemCategories[ tier ][ randomInt( size ) ];
    }

    private getClosestTier( currentTier: number )
    {
        let closestDistance = 9999;
        let closestTier = 9999;
        for ( const tier of this.itemTiers )
        {
            const tempDistance = Math.abs( currentTier - tier );
            if ( tempDistance < closestDistance )
            {
                closestDistance = tempDistance;
                closestTier = tier;
            }
        }
        return closestTier;
    }

    private findItemCategoryTier( item: string ): number
    {
        for ( const tier in this.itemCategories )
        {
            if ( tier.includes( item ) )
            {
                return Number( tier );
            }
        }
        return -1;
    }

    private getQuestLocationText( quest: IQuest ): string 
    {
        //Use a set to get all maps, but we only care if they exist or not.
        let maps = new Set<string>();

        //Check all completion conditions
        for ( const task of quest.conditions.AvailableForFinish )
        {
            //Check for zoneID in the direct condition
            if ( task.zoneId )
            {
                const temp = this.zoneIDToMap( task.zoneId )
                if ( temp === "unknown" )
                {
                    return "any";
                }
                maps.add( temp );
            }

            //Check if its a counter condition
            if ( task.counter )
            {
                //Go through each counter condition
                for ( const condition of task.counter.conditions )
                {
                    //Check fo the existence of zoneIds (they exist dammit, spt!)
                    if ( condition.zoneIds )
                    {
                        for ( const zone of condition.zoneIds )
                        {
                            const temp = this.zoneIDToMap( zone )
                            if ( temp === "unknown" )
                            {
                                return "any";
                            }
                            maps.add( temp );
                        }
                    }
                    //Check if there are location type conditions
                    if ( condition.conditionType === "Location" )
                    {
                        for ( const map of condition.target )
                        {
                            let temp = "";

                            //They're sometimes arrays, sometimes not. Fuck you BSG!
                            if ( Array.isArray( condition.target ) )
                            {
                                temp = condition.target[ 0 ];
                            }
                            else
                            {
                                temp = condition.target;
                            }
                            maps.add( temp );
                        }
                    }
                }
            }
        }
        //If the sets size is exactly 1, we're only on a single map in total.
        if ( maps.size === 1 )
        {
            return Array.from( maps.values() )[ 0 ];
        }

        //Else, we're not on a map in particular, or we're on more than one map. either way, "any" applies.
        return "any";
    }

    private zoneIDToMap( zoneID: string ): string
    {
        for ( let map in this.questpoints )
        {
            if ( this.questpoints[ map ][ zoneID ] )
            {
                return map;
            }
        }
        return "unknown";
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
            hasKillFailstate: hasKillsFailstate ? 1 : -1
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
                task.value = this.generateValueAdjustment( previousValue, this.config.adjustKillCountFactorsUpDown );
            }

            const templocale = this.generateKillsLocale( task, flags )
            this.editTaskLocale( task, templocale );

        }
        //We don't edit anything else with counters for now.
        return;
    }

    private editTaskLocale( task: IQuestCondition, templocale: string )
    {
        const taskid = task.id;
        this.localizationChanges[ taskid ] = templocale;
        this.databaseServer.getTables().locales.global[ this.config.targetLocale ][ taskid ] = templocale;
        this.printColor( templocale, LogTextColor.MAGENTA );
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
        locationData.target = this.getUniqueValues( this.validMaps, mapCount );

        //Index will be the length minus 1
        flags.hasLocation = conditions.push( locationData ) - 1;
    }

    private checkForSubconditionType( type: string, searchTarget: any )
    {
        //Hackiest shit ever
        if ( this.jsonUtil.serialize( searchTarget ).search( `${ type }` ) > -1 )
        {
            return true;
        }
        return false;
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
        locations.target = this.getUniqueValues( this.validMaps, mapCount );
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
                target += `${ role } `;
            }
        }
        else
        {
            target = conditions[ flags.hasKills ].target as string;
        }

        let line: string = `Kill ${ kills } ${ target } `;

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
        //LEAVE FOR NOW
    }

    private getBodyparts( count: number ): string[]
    {
        let tempArray = this.getUniqueValues( this.bodyParts, count );
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

    //Uses set to guarantee unique values.
    private getUniqueValues<T>( array: T[], count: number ): T[]
    {
        if ( count > array.length )
        {
            count = array.length;
        }

        let generatedValues = new Set<T>();

        while ( generatedValues.size < count )
        {
            generatedValues.add( array[ randomInt( array.length ) ] );
        }

        return Array.from( generatedValues.values() );
    }

    private debugJsonOutput( jsonObject: any, label: string = "" )
    {
        if ( label.length > 0 )
        {
            this.logger.logWithColor( "[" + label + "]", LogTextColor.GREEN );
        }
        this.logger.logWithColor( JSON.stringify( jsonObject, null, 4 ), LogTextColor.MAGENTA );
    }

    private printColor( message: string, color: LogTextColor = LogTextColor.GREEN )
    {
        this.logger.logWithColor( message, color );
    }

    private dataDump()
    {
        const parents =
            [
                "-5448e54d4bdc2dcc718b4568", //Armor
                "5a341c4086f77401f2541505", //Headwear
                "-5448e5284bdc2dcb718b4567" //Vest
            ]
        const itemDB = this.databaseServer.getTables().templates.items;
        const locale = this.databaseServer.getTables().locales.global[ "en" ];
        for ( const item in itemDB )
        {
            if ( parents.includes( itemDB[ item ]._parent ) )
            {
                this.printColor( `"${ item }", //${ locale[ item + " Name" ] }` );
            }
        }
    }

}

module.exports = { mod: new Questrandomizer() }
