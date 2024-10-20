import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import { LeavesUtils } from "./LeavesUtils";

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

    public addLocationToQuest( conditions: IQuestConditionCounterCondition[], maps:string[] ):number
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

}