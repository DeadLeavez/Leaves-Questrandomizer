import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import { LeavesUtils } from "./LeavesUtils";
import { QuestStatus } from "@spt/models/enums/QuestStatus";
import { QuestRewardType } from "@spt/models/enums/QuestRewardType";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { randomInt } from "crypto";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";


export class Depth
{
    constructor()
    {
        this.depth = 0;
        this.level = 0;
    }
    depth: number;
    level: number;
}

@injectable()
export class LeavesQuestTools
{
    private questPoints: any;
    private depthList: Record<string, Depth>;

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
        @inject( "LeavesSettingsManager" ) protected leavesSettingsManager: LeavesSettingsManager,
        @inject( "LeavesLocaleGeneration" ) protected leavesLocaleGeneration: LeavesLocaleGeneration,
        @inject( "WeightedRandomHelper" ) protected weightedRandomHelper: WeightedRandomHelper,
        @inject( "HandbookHelper" ) protected handbookHelper: HandbookHelper
    )
    { }

    public changeXPOnQuest( quest: IQuest, multiplier: number )
    {
        for ( let reward of quest.rewards.Success )
        {
            if ( reward.type === "Experience" )
            {
                const previousReward = parseInt( reward.value as string ); //Lmao bsg
                reward.value = ( previousReward * multiplier ).toString();
            }
        }
        return;
    }

    public generateDepthList()
    {
        this.depthList = {};
        for ( const QuestID in this.databaseServer.getTables().templates.quests )
        {
            this.depthList[ QuestID ] = this.findDepth( this.depthList, QuestID );
        }
        this.leavesUtils.printColor( "[Questrandomizer] Generated depth list of all quests" );
    }

    private findDepth( depthList: Record<string, Depth>, QuestID: string ): Depth
    {
        const quest: IQuest = this.databaseServer.getTables().templates.quests[ QuestID ];
        let currentDepth = new Depth();
        for ( const condition of quest.conditions.AvailableForStart )
        {
            if ( condition.conditionType === "Quest" )
            {
                const target = condition.target as string;
                if ( depthList[ target ] )
                {
                    const tempDepth = depthList[ target ].depth + 1;
                    const tempLevel = depthList[ target ].level;
                    if ( currentDepth.depth < tempDepth )
                    {
                        currentDepth.depth = tempDepth;
                    }
                    if ( currentDepth.level < tempLevel )
                    {
                        currentDepth.level = tempLevel;
                    }
                }
                else
                {
                    depthList[ target ] = this.findDepth( depthList, target );
                }
            }
            if ( condition.conditionType === "Level" )
            {
                if ( currentDepth.level < ( condition.value as number ) )
                {
                    currentDepth.level = condition.value as number;
                }
            }
        }
        return currentDepth;
    }

    public getQuestDepth( questID: string ): Depth
    {
        return this.depthList[ questID ];
    }
    public getDepthList(): Record<string, Depth>
    {
        return this.depthList;
    }

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

    public findCounterConditionType( conditions:IQuestConditionCounterCondition[], type: string ): number
    {
        for ( let i = 0; i < conditions.length; ++i )
        {
            if ( conditions[i].conditionType === type )
            {
                return i;
            }
        }
        return -1;
    }

    public addKillObjectiveToQuest( quest: IQuest, target: string, count: number )
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
                    }
                ],
                "id": this.hashUtil.generate()
            },
            "doNotResetIfCounterCompleted": false,
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "id": this.hashUtil.generate(),
            "index": quest.conditions.AvailableForFinish.length,
            "oneSessionOnly": false,
            "parentId": "",
            "type": "Elimination",
            "value": count,
            "visibilityConditions": []
        };

        quest.conditions.AvailableForFinish.push( objectiveData );
        
        return;
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

    public addHandOverObjectiveToQuest( quest: IQuest, count: number, items: string[] ): number
    {
        let objectiveData = {
            "conditionType": "HandoverItem",
            "dogtagLevel": 0,
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "id": this.hashUtil.generate(),
            "index": quest.conditions.AvailableForFinish.length,
            "isEncoded": false,
            "maxDurability": 100,
            "minDurability": 0,
            "onlyFoundInRaid": false,
            "parentId": "",
            "target": [],
            "value": count,
            "visibilityConditions": []
        }

        objectiveData.target.push( ...items );

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

    public addPrerequisiteQuest( targetQuest: IQuest, previousQuestID: string, statuses: QuestStatus[] )
    {
        let prereqQuestCondition: any =
        {
            "conditionType": "Quest",
            "id": this.hashUtil.generate(),
            "index": targetQuest.conditions.AvailableForStart.length,
            "parentId": "",
            "dynamicLocale": false,
            "target": previousQuestID,
            "status": statuses,
            "globalQuestCounterId": "",
            "availableAfter": 0,
            "dispersion": 0,
            "visibilityConditions": []
        };

        targetQuest.conditions.AvailableForStart.push( prereqQuestCondition );
    }

    public addPrerequisiteLevel( targetQuest: IQuest, requiredLevel: number )
    {
        let prereqQuestCondition: any =
        {
            "conditionType": "Level",
            "id": this.hashUtil.generate(),
            "index": targetQuest.conditions.AvailableForStart.length,
            "parentId": "",
            "dynamicLocale": false,
            "globalQuestCounterId": "",
            "value": requiredLevel,
            "compareMethod": ">=",
            "visibilityConditions": []
        };

        targetQuest.conditions.AvailableForStart.push( prereqQuestCondition );
    }

    public addRewardExperience( targetQuest: IQuest, experienceCount: number )
    {
        let reward =
        {
            availableInGameEditions: [],
            value: experienceCount,
            id: this.hashUtil.generate(),
            type: QuestRewardType.EXPERIENCE,
            index: targetQuest.rewards.Success.length,
            unknown: false
        };
        targetQuest.rewards.Success.push( reward );
    }

    public addRandomWeaponGroup( condition: IQuestConditionCounterCondition, flags: any )
    {
        flags.hasWeapon = 1;
        
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
        this.addWeaponGroup( group, condition );
    }

    public addWeaponGroup( group: string, condition: IQuestConditionCounterCondition )
    {
        const weaponGroup = this.leavesSettingsManager.getWeaponCategories().categories[ group ];
        condition.weapon = weaponGroup.weapons;

        //Add weapon mods
        const modsInclusive = weaponGroup[ "mods-inclusive" ];
        for ( const modgroup in modsInclusive )
        {
            condition.weaponModsInclusive = this.addModsToWeaponModGroup( modgroup, condition.weaponModsInclusive, modsInclusive[ modgroup ] );
        }

        const modsExclusive = weaponGroup[ "mods-exclusive" ];
        for ( const modgroup in modsExclusive )
        {
            condition.weaponModsExclusive = this.addModsToWeaponModGroup( modgroup, condition.weaponModsExclusive, modsExclusive[ modgroup ] );
        }
    }

    public addModsToWeaponModGroup( modGroup: string, weaponModsCurrent: string[][], merge: boolean ): string[][]
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

    public randomizeWeapons( killsCondition: IQuestConditionCounterCondition, flags: any )
    {
        if ( killsCondition.weapon.length > 0 )
        {  
            this.addRandomWeaponGroup( killsCondition, flags );
        }
        else if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddWeapon )
        {
            this.addRandomWeaponGroup( killsCondition, flags );
        }
    }

    public randomizeDistance( killsCondition: IQuestConditionCounterCondition, flags: any )
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

    public randomizeTimeOfDay( killsCondition: IQuestConditionCounterCondition, flags: any )
    {
        if ( flags.whatLoctations.includes( "factory4_day" ) || flags.whatLoctations.includes( "factory4_night" ) || flags.whatLoctations.includes( "laboratory" ) ) //Convert to array?
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

    public randomizeBodyPart( killsCondition: IQuestConditionCounterCondition, flags: any )
    {
        if ( killsCondition.bodyPart.length > 0 )
        {
            //check if the quest has body part requirement.
            killsCondition.bodyPart = this.leavesSettingsManager.getBodypartSelection( killsCondition.bodyPart.length );
            flags.hasBodyparts = killsCondition.bodyPart.length;
        }
        else if ( Math.random() < this.leavesSettingsManager.getConfig().chanceToAddBodypart )
        {
            //Chance to add it.
            killsCondition.bodyPart = this.leavesSettingsManager.getBodypartSelection( 2 );
            flags.hasBodyparts = 2;
        }
    }

    public randomizeTarget( killsCondition: IQuestConditionCounterCondition, flags: any )
    {
        if ( killsCondition.savageRole?.length > 0 )
        {
            flags.hasSavageRole = 1;
        }

        else
        {
            const validTargets = this.leavesSettingsManager.getValidTargets();
            const previousTarget: string = killsCondition.target as string;
            killsCondition.target = validTargets.at( randomInt( this.leavesSettingsManager.getValidTargets().length - 1 ) );
            flags.killsEnemyTypeDistance = validTargets.indexOf( previousTarget ) - validTargets.indexOf( killsCondition.target );
        }
    }

    public randomizeHandover( task: IQuestCondition, originalItem: string )
    {
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
            if ( tier === -1 )
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

        this.leavesLocaleGeneration.generateHandoverItemLocale( task, categoryName );
    }

    public randomizeLocations( locations: IQuestConditionCounterCondition, flags: any, )
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

    /*
    DON'T GIVE MULTIPLE OF NONSTACKABLE ITEMS. JESUS CHRIST CURSED SHIT WILL HAPPEN. JUST DON'T
    */
    public addRewardItem( targetQuest: IQuest, itemID: string, count: number, FIR: boolean )
    {
        const rewardGroupID = this.hashUtil.generate();
        let reward =
        {
            "availableInGameEditions": [],
            "value": 1,
            "id": this.hashUtil.generate(),
            type: QuestRewardType.ITEM,
            "index": targetQuest.rewards.Success.length,
            "target": rewardGroupID,
            "unknown": false,
            "findInRaid": true,
            "items": []
        }
        let item =
        {
            "_id": rewardGroupID,
            "_tpl": itemID,
            "upd": {
                "StackObjectsCount": count,
                "SpawnedInSession": FIR
            }
        }

        reward.items.push( item );

        targetQuest.rewards.Success.push( reward );
    }
}