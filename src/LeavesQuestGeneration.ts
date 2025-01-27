import { IQuest } from "@spt/models/eft/common/tables/IQuest";
import { QuestTypeEnum } from "@spt/models/enums/QuestTypeEnum";
import { ELocationName } from "@spt/models/enums/ELocationName";
import { QuestStatus } from "@spt/models/enums/QuestStatus";

import { LeavesUtils } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { LeavesIdManager } from "./LeavesIdManager";
import { randomInt } from "node:crypto";

export class LeavesQuestGeneration
{
    constructor(
        private leavesUtils: LeavesUtils,
        private leavesQuestTools: LeavesQuestTools,
        private leavesSettingsManager: LeavesSettingsManager,
        private leavesLocaleGeneration: LeavesLocaleGeneration,
        private leavesIdManager: LeavesIdManager
    )
    { }


    public generateEmptyQuest( name: string, trader: string, location: string, ID: string ): IQuest
    {
        let newQuest: any =
        {
            QuestName: name,
            _id: ID,
            canShowNotificationsInGame: true,
            acceptPlayerMessage: `${ ID } acceptPlayerMessage`,
            changeQuestMessageText: `${ ID } changeQuestMessageText`,
            completePlayerMessage: `${ ID } completePlayerMessage`,
            conditions: {
                AvailableForFinish: [],
                AvailableForStart: [],
                Fail: [],
            },
            description: `${ ID } description`,
            failMessageText: `${ ID } failMessageText`,
            declinePlayerMessage: `${ ID } declinePlayerMessage`,
            name: `${ ID } name`,
            note: `${ ID } note`,
            traderId: trader,
            location: location,
            image: `/files/quest/icon/65899d03adeac0191c51e880.jpg`,
            type: QuestTypeEnum.COMPLETION,
            isKey: false,
            restartable: false,
            instantComplete: false,
            secretQuest: false,
            startedMessageText: `${ ID } startedMessageText`,
            successMessageText: `${ ID } successMessageText`,
            rewards: {
                Started: [],
                Success: [],
                Fail: []
            },
            side: `Pmc`
        }
        return newQuest;
    }

    public setBaseQuestLocale(
        ID: string,
        locale: string,
        acceptPlayerMessage: string,
        changeQuestMessageText: string,
        completePlayerMessage: string,
        description: string,
        failMessageText: string,
        declinePlayerMessage: string,
        startedMessageText: string,
        successMessageText: string,
        questName: string
    )
    {
        this.leavesLocaleGeneration.editLocaleText( `${ ID } acceptPlayerMessage`, acceptPlayerMessage, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } changeQuestMessageText`, changeQuestMessageText, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } completePlayerMessage`, completePlayerMessage, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } description`, description, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } failMessageText`, failMessageText, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } declinePlayerMessage`, declinePlayerMessage, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } startedMessageText`, startedMessageText, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } successMessageText`, successMessageText, locale );
        this.leavesLocaleGeneration.editLocaleText( `${ ID } name`, questName, locale );
    }

    public addRewardsToQuest( quest: IQuest, questNumber: number )
    {
        let rewardTiers = this.leavesSettingsManager.getConfig().QuestGen_RewardPools;
        let rewardTable = this.leavesSettingsManager.getRewardsTable();

        let selectedTier = "common";
        selectedTier = questNumber >= rewardTiers.common ? "common" : selectedTier;
        selectedTier = questNumber >= rewardTiers.rare ? "rare" : selectedTier;
        selectedTier = questNumber >= rewardTiers.epic ? "epic" : selectedTier;

        const selectedReward = rewardTable[ selectedTier ][ randomInt( rewardTable[ selectedTier ].length ) ];

        this.leavesQuestTools.addRewardExperience( quest, this.leavesSettingsManager.getConfig().QuestGen_XPPerQuest * questNumber );
        this.leavesQuestTools.addRewardItem( quest, selectedReward, 1, true );
        return;
    }

    public generateKillQuest( name: string, previousQuest: string, trader: string, questNumber: number, killCount: number, specificWeaponGroup: string = "", distance: boolean = false ): IQuest
    {
        const questID = this.leavesIdManager.get( name + questNumber );

        //Make empty quest
        let newQuest = this.generateEmptyQuest( name, trader, ELocationName.ANY, questID );

        //Add previous quest, unless we're at the first quest
        if ( questNumber !== 0 )
        {
            this.leavesQuestTools.addPrerequisiteQuest( newQuest, previousQuest, [ QuestStatus.Success ] );
        }

        this.addRewardsToQuest( newQuest, questNumber );

        //Add the kill objective
        this.leavesQuestTools.addKillObjectiveToQuest( newQuest, "Any", killCount );

        //Set up flags
        let flags =
        {
            hasInZone: -1,
            hasKills: 0,
            hasLocation: -1,
            whatLoctations: [],
            hasDistance: distance ? 1 : -1,
            hasTime: -1,
            hasBodyparts: -1,
            hasWeapon: specificWeaponGroup !== "" ? 1 : -1,
            hasSpecificWeapon: -1,
            whatWeaponOrGroup: specificWeaponGroup,
            hasSavageRole: -1,
            hasKillFailstate: -1,
            hasEquipment: -1,
            questID: newQuest._id,
            isEasyQuest: false,
        }

        let killCondition = newQuest.conditions.AvailableForFinish[ 0 ].counter.conditions[ 0 ];

        //randomize weapon group unless provided.
        if ( specificWeaponGroup === "" )
        {
            this.leavesQuestTools.addRandomWeaponGroup( killCondition, flags );
        }
        else
        {
            this.leavesQuestTools.addWeaponGroup( specificWeaponGroup, killCondition );
        }

        //Add distance if requested
        if ( distance )
        {
            killCondition.distance.compareMethod = ">=";
            killCondition.distance.value = Math.min( 200, 50 + questNumber * 10 );
        }

        //Generate locale for the kill condition
        this.leavesLocaleGeneration.generateKillsLocale( newQuest.conditions.AvailableForFinish[ 0 ], flags );

        //Generate quest locales
        for ( const locale of this.leavesLocaleGeneration.getLoadedLocales() )
        {
            this.setBaseQuestLocale(
                newQuest._id,
                locale,
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 1, //"ACCEPTMESSAGE",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 2, //"CHANGEQUESTMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 3, //"COMPLETEMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( `${ name }Description`, locale ), //"DESCRIPTION",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 4, //"FAILMESSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 5, //"DECLINEMSSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( `${ name }Accept`, locale ), //"STARTEDMESSAGE",
                this.leavesLocaleGeneration.getLoc( `${ name }Success`, locale ), //"SUCCESSMESSAGE",
                this.leavesLocaleGeneration.getLoc( `${ name }Name`, locale ) + ( questNumber + 1 ), //QUESTNAME
            )
        }

        //Reteurn generated quest
        return newQuest;
    }

    public generateHandoverQuest( name: string, previousQuest: string, trader: string, questNumber: number ): IQuest
    {
        const questID = this.leavesIdManager.get( name + questNumber );

        //Make empty quest
        let newQuest = this.generateEmptyQuest( name, trader, ELocationName.ANY, questID );

        //Add previous quest, unless we're at the first quest
        if ( questNumber !== 0 )
        {
            this.leavesQuestTools.addPrerequisiteQuest( newQuest, previousQuest, [ QuestStatus.Success ] );
        }

        this.addRewardsToQuest( newQuest, questNumber );

        //Add the handover objective

        let tier = this.leavesUtils.getClosestTier( questNumber );
        const maxtier = this.leavesSettingsManager.getConfig().QuestGen_HandoverMaxTier;
        if ( tier > maxtier )
        {
            tier = this.leavesUtils.getClosestTier( maxtier );
        }

        const itemToFind: string = this.leavesUtils.getRandomItemFromTier( tier );

        const needsFoundInRaid = Math.random() < this.leavesSettingsManager.getConfig().QuestGen_HandoverFIRChance;
        this.leavesQuestTools.addHandOverObjectiveToQuest( newQuest, 5, [ itemToFind ], needsFoundInRaid );

        //Generate locale for the kill condition
        this.leavesLocaleGeneration.generateHandoverItemLocale( newQuest.conditions.AvailableForFinish[ 0 ], "" );

        //Generate quest locales
        for ( const locale of this.leavesLocaleGeneration.getLoadedLocales() )
        {
            this.setBaseQuestLocale(
                newQuest._id,
                locale,
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 1, //"ACCEPTMESSAGE",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 2, //"CHANGEQUESTMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 3, //"COMPLETEMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( `${ name }Description`, locale ), //"DESCRIPTION",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 4, //"FAILMESSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 5, //"DECLINEMSSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( `${ name }Accept`, locale ), //"STARTEDMESSAGE",
                this.leavesLocaleGeneration.getLoc( `${ name }Success`, locale ), //"SUCCESSMESSAGE",
                this.leavesLocaleGeneration.getLoc( `${ name }Name`, locale ) + ( questNumber + 1 ), //QUESTNAME
            )
        }

        //Reteurn generated quest
        return newQuest;
    }

}