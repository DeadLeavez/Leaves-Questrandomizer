import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import { LeavesUtils } from "./LeavesUtils";
import { QuestTypeEnum } from "@spt/models/enums/QuestTypeEnum";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { Traders } from "@spt/models/enums/Traders";
import { ELocationName } from "@spt/models/enums/ELocationName";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesLocaleGeneration } from "./LeavesLocaleGeneration";
import { QuestStatus } from "@spt/models/enums/QuestStatus";
import { kill } from "process";

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
        @inject( "LeavesLocaleGeneration" ) protected leavesLocaleGeneration: LeavesLocaleGeneration
    )
    {
    }


    public generateEmptyQuest( name: string, trader: string, location: string ): IQuest
    {
        const ID = this.hashUtil.generate();

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

    public generateWeaponMasteryQuest( name:string, previousQuest:string, trader:string, questNumber:number ):IQuest
    {
        const questDB = this.databaseServer.getTables().templates.quests;

        //Make empty quest
        let newQuest = this.generateEmptyQuest( name, trader, ELocationName.ANY );
        this.leavesQuestTools.addPrerequisiteQuest( newQuest, "657315df034d76585f032e01", [QuestStatus.Success] );

        this.leavesQuestTools.addRewardExperience( newQuest, 666 );
        this.leavesQuestTools.addRewardItem( newQuest, "57347c5b245977448d35f6e1", 1, true );
        //this.leavesQuestTools.addPrerequisiteLevel( newQuest, 5 );
        const killIndex = this.leavesQuestTools.addKillObjectiveToQuest( newQuest, "Any", 5 );
        

        let flags =
        {
            hasInZone: -1,
            hasKills: killIndex,
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

        //const handoverIndex = this.leavesQuestTools.addHandOverObjectiveToQuest( newQuest, 1, [ this.leavesUtils.getRandomItemFromTier( 5 ) ] );
        //this.leavesLocaleGeneration.generateHandoverItemLocale( newQuest.conditions.AvailableForFinish[ handoverIndex ], "" );
        this.leavesLocaleGeneration.generateKillsLocale( newQuest.conditions.AvailableForFinish[ killIndex ], flags );
        for ( const locale of this.leavesLocaleGeneration.getLoadedLocales() )
        {
            this.setBaseQuestLocale(
                newQuest._id,
                locale,
                "ACCEPTMESSAGE",
                "CHANGEQUESTMESSAGE",
                "COMPLETEMESSAGE",
                "DESCRIPTION",
                "FAILMESSAGE",
                "DECLINEMSSAGE",
                "STARTEDMESSAGE",
                "SUCCESSMESSAGE",
                "QUESTNAME",
            )
        }
        questDB[ newQuest._id ] = newQuest;
        this.leavesUtils.debugJsonOutput( newQuest );
        return newQuest;
    }

}