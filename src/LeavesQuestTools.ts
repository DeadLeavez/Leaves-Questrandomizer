import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import { LeavesUtils } from "./LeavesUtils";
import { QuestTypeEnum } from "@spt/models/enums/QuestTypeEnum";
import { QuestStatus } from "@spt/models/enums/QuestStatus";

@injectable()
export class LeavesQuestTools
{
    private questPoints: any;

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils
    )
    { }

    public setQuestPoints( points: any )
    {
        this.questPoints = points;
    }

    public zoneIDToMap( zoneID: string ): string
    {
        for ( let map in this.questPoints )
        {
            if ( this.questPoints[ map ][ zoneID ] )
            {
                return map;
            }
        }
        return "unknown";
    }

    public addKillObjectiveToQuest( quest: IQuest, target: string, count: number ): number
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
                        "target": target,
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
            "value": count,
            "visibilityConditions": []
        };

        return quest.conditions.AvailableForFinish.push( objectiveData ) - 1;
    }

    public addGearToQuest( condition: IQuestConditionCounterCondition[], gearPieces: string[] ): number
    {
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

    public addHandOverObjectiveToQuest( quest: IQuest, count: number ): number
    {
        let objectiveData = {
            "conditionType": "HandoverItem",
            "dogtagLevel": 0,
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "id": this.hashUtil.generate(),
            "index": 1,
            "isEncoded": false,
            "maxDurability": 15,
            "minDurability": 0,
            "onlyFoundInRaid": true,
            "parentId": "",
            "target": [
                "5447a9cd4bdc2dbd208b4567"
            ],
            "value": count,
            "visibilityConditions": []
        }

        return quest.conditions.AvailableForFinish.push( objectiveData ) - 1;
    }

    public addLocationToQuest( conditions: IQuestConditionCounterCondition[], maps: string[] ): number
    {
        let locationData =
        {
            "conditionType": "Location",
            "dynamicLocale": false,
            "id": this.hashUtil.generate(),
            "target": maps
        }

        //Index will be the length minus 1
        return conditions.push( locationData ) - 1;
    }

    public getQuestLocationText( quest: IQuest ): string 
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
                            const temp = this.zoneIDToMap( task.zoneId )
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

    public generateKillsLocale( task: IQuestCondition, flags: any, localizationChangesToSave: any )
    {
        for ( const targetLocale of this.leavesUtils.getLoadedLocales() )
        {
            const kills = task.value as number;
            const conditions = task.counter.conditions;
            let target: string = "";
            if ( flags.hasSavageRole >= 0 )
            {
                for ( let role of conditions[ flags.hasKills ].savageRole ) 
                {
                    const targetTranslated = this.leavesUtils.getLoc( role.toLocaleLowerCase(), targetLocale );
                    target += `${ targetTranslated } `;
                }
            }
            else
            {
                target = conditions[ flags.hasKills ].target as string;
                target = this.leavesUtils.getLoc( target.toLocaleLowerCase(), targetLocale ) + " ";
            }

            let line: string = `${ this.leavesUtils.getLoc( "Kill", targetLocale ) } ${ kills } ${ target }`;

            //Distance
            if ( flags.hasDistance >= 0 )
            {
                const distance = conditions[ flags.hasKills ].distance.compareMethod as string + " " + conditions[ flags.hasKills ].distance.value as string;
                line += `${ this.leavesUtils.getLoc( "AtDistance", targetLocale ) } ${ distance }m `;
            }

            //Time of day //Skip if labs or factory
            if ( flags.hasTime >= 0 )
            {
                const start: string = ( conditions[ flags.hasKills ].daytime.from ).toString().padStart( 2, `0` );
                const finish: string = ( conditions[ flags.hasKills ].daytime.to ).toString().padStart( 2, `0` );
                line += `${ this.leavesUtils.getLoc( "DuringTimeOfDay", targetLocale ) } ${ start }-${ finish } `;
            }

            //Weapon requirements
            if ( flags.hasWeapon >= 0 )
            {
                line += `${ this.leavesUtils.getLoc( "usingWeaponGroup", targetLocale ) } `;
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
                let bodypartsline = `${ this.leavesUtils.getLoc( "inBodyPart", targetLocale ) }: `;
                //for ( let partindex = 0; partindex < conditions[ flags.hasKills ].bodyPart.length; partindex++ )
                for ( const bodyPart of conditions[ flags.hasKills ].bodyPart )
                {
                    bodypartsline += `${ this.leavesUtils.getLoc( bodyPart, targetLocale ) } `
                }
                line += bodypartsline;
            }

            //Location
            if ( flags.hasLocation >= 0 )
            {
                let hasAddedGz = false;
                let mapsline = `${ this.leavesUtils.getLoc( "atLocation", targetLocale ) } `;
                for ( const map of conditions[ flags.hasLocation ].target )
                {
                    if ( map.toLowerCase() === "sandbox" || map.toLowerCase() === "sandbox_high" )
                    {
                        if ( !hasAddedGz )
                        {
                            mapsline += `${ this.leavesUtils.getLoc( "sandbox", targetLocale ) } `;
                            hasAddedGz = true;
                        }
                    }
                    else
                    {
                        mapsline += `${ this.leavesUtils.getLoc( map.toLowerCase(), targetLocale ) } `;
                    }
                }
                line += mapsline;
            }

            //Gear
            if ( flags.hasEquipment >= 0 )
            {
                line += `${ this.leavesUtils.getLoc( "wearingGear", targetLocale ) }:\n`;
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

            this.leavesUtils.editLocaleText( task.id, line, targetLocale, localizationChangesToSave );
        }
    }

    public generateHandoverItemLocale( task: IQuestCondition, categoryName: string, localizationChangesToSave: any )
    {
        for ( const targetLocale of this.leavesUtils.getLoadedLocales() )
        {
            let line = `${ this.leavesUtils.getLoc( "HandoverItem", targetLocale ) } `; //Hand over
            line += `${ task.value } ${ this.leavesUtils.getLoc( "ofItem", targetLocale ) } `; //x counts of
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
                    newName = this.leavesUtils.getLoc( `ITEMCATEGORY_${ categoryName }`, targetLocale );
                }

                //If the local DB fails, we use the category name, as is.
                if ( newName == null )
                {
                    newName = categoryName;
                }

                line += `${ this.leavesUtils.getLoc( "itemsFromThe", targetLocale ) } ` // items from the
                line += `${ newName } `;
                line += `${ this.leavesUtils.getLoc( "Category", targetLocale ) }` // category
            }

            this.leavesUtils.editLocaleText( task.id, line, targetLocale, localizationChangesToSave );
        }
    }

    public purgeFindItemTasks( tasks: IQuestCondition[] )
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

    public addQuestPrerequisite( targetQuest: IQuest, previousQuestID: string )
    {
        let prereqQuestCondition: any =
        {
            "conditionType": "Quest",
            "id": this.hashUtil.generate(),
            "index": 0,
            "parentId": "",
            "dynamicLocale": false,
            "target": previousQuestID,
            "status": [
                QuestStatus.Started,
                QuestStatus.Success
            ],
            "globalQuestCounterId": "",
            "availableAfter": 0,
            "dispersion": 0,
            "visibilityConditions": []
        }

        targetQuest.conditions.AvailableForStart.push( prereqQuestCondition );
    }

    public addLevelPrerequisite( targetQuest: IQuest, requiredLevel: number )
    {
        let prereqQuestCondition: any =
        {
            "conditionType": "Level",
            "id": this.hashUtil.generate(),
            "index": 1,
            "parentId": "",
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "value": requiredLevel,
            "compareMethod": ">=",
            "visibilityConditions": []
        }
        
        targetQuest.conditions.AvailableForStart.push( prereqQuestCondition );
    }
}