import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import { QuestTypeEnum } from "@spt/models/enums/QuestTypeEnum";
import { ELocationName } from "@spt/models/enums/ELocationName";
import { QuestStatus } from "@spt/models/enums/QuestStatus";

import { LeavesUtils } from "./LeavesUtils";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { LeavesIdManager } from "./LeavesIdManager";
import { randomInt } from "node:crypto";
import { kill } from "node:process";

@injectable()
export class LeavesQuestGeneration
{
    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
        @inject( "LeavesQuestTools" ) protected leavesQuestTools: LeavesQuestTools,
        @inject( "LeavesSettingsManager" ) protected leavesSettingsManager: LeavesSettingsManager,
        @inject( "LeavesLocaleGeneration" ) protected leavesLocaleGeneration: LeavesLocaleGeneration,
        @inject( "LeavesIdManager" ) protected leavesIdManager: LeavesIdManager
    )
    {
    }


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

    public generateWeaponMasteryQuest( name: string, previousQuest: string, trader: string, questNumber: number ): IQuest
    {
        const questDB = this.databaseServer.getTables().templates.quests;
        const questID = this.leavesIdManager.get( name );

        //Make empty quest
        let newQuest = this.generateEmptyQuest( name, trader, ELocationName.ANY, questID );

        if ( questNumber !== 0 )
        {
            this.leavesQuestTools.addPrerequisiteQuest( newQuest, previousQuest, [ QuestStatus.Success ] );
        }

        this.addRewardsToQuest( newQuest, questNumber );

        for ( let i = 0; i < Math.max( 1, questNumber / 10 ); ++i )
        {
            this.leavesQuestTools.addKillObjectiveToQuest( newQuest, "Any", 5 + questNumber * 2 );

            let flags =
            {
                hasInZone: -1,
                hasKills: 0,
                hasLocation: -1,
                whatLoctations: [],
                hasDistance: -1,
                hasTime: -1,
                hasBodyparts: -1,
                hasWeapon: -1,
                hasSpecificWeapon: -1,
                whatWeaponOrGroup: "",
                hasSavageRole: -1,
                hasKillFailstate: -1,
                hasEquipment: -1,
                questID: newQuest._id,
                isEasyQuest: false,
            }
            this.leavesQuestTools.addRandomWeaponGroup( newQuest.conditions.AvailableForFinish[ i ].counter.conditions[ 0 ], flags );

            this.leavesLocaleGeneration.generateKillsLocale( newQuest.conditions.AvailableForFinish[ i ], flags );
        }
        for ( const locale of this.leavesLocaleGeneration.getLoadedLocales() )
        {
            this.setBaseQuestLocale(
                newQuest._id,
                locale,
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 1, //"ACCEPTMESSAGE",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 2, //"CHANGEQUESTMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 3, //"COMPLETEMESSAGE", - //Never shows
                this.leavesLocaleGeneration.getLoc( "QG_WeaponMasteryDescription", locale ), //"DESCRIPTION",
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 4, //"FAILMESSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( "QG_ReportThis", locale ) + 5, //"DECLINEMSSAGE", - //never shows
                this.leavesLocaleGeneration.getLoc( "QG_WeaponMasteryAccept", locale ), //"STARTEDMESSAGE",
                this.leavesLocaleGeneration.getLoc( "QG_WeaponMasterySuccess", locale ), //"SUCCESSMESSAGE",
                this.leavesLocaleGeneration.getLoc( "QG_WeaponMasteryName", locale ) + ( questNumber + 1 ), //QUESTNAME
            )
        }
        questDB[ newQuest._id ] = newQuest;
        //this.leavesUtils.debugJsonOutput( newQuest );
        return newQuest;
    }

}