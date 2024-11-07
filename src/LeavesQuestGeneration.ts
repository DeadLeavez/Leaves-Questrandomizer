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
        @inject( "LeavesQuestTools" ) protected leavesQuestTools: LeavesQuestTools
    )
    { }

    private config: any;
    private localizationChangesToSave: any;

    public setConfig( config: any )
    {
        this.config = config;
    }
    
    public setLocalizationChanges( localizationChanges: any )
    {
        this.localizationChangesToSave = localizationChanges;
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
        questName: string,
        localizationChanges: any
    )
    {
        this.leavesUtils.editLocaleText( `${ ID } acceptPlayerMessage`, acceptPlayerMessage, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } changeQuestMessageText`, changeQuestMessageText, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } completePlayerMessage`, completePlayerMessage, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } description`, description, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } failMessageText`, failMessageText, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } declinePlayerMessage`, declinePlayerMessage, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } startedMessageText`, startedMessageText, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } successMessageText`, successMessageText, locale, localizationChanges );
        this.leavesUtils.editLocaleText( `${ ID } name`, questName, locale, localizationChanges );
    }

    public generateQuest()
    {
        const questDB = this.databaseServer.getTables().templates.quests;
        let newQuest = this.generateEmptyQuest( "TestQuest", Traders.PRAPOR, ELocationName.ANY );

        //const killIndex = this.leavesQuestTools.addKillObjectiveToQuest( newQuest, "Savage", 5 );
        //this.leavesQuestTools.addPrerequisiteQuest( newQuest, "657315df034d76585f032e01" );
        //this.leavesQuestTools.addPrerequisiteLevel( newQuest, 0 );
        this.leavesQuestTools.addRewardExperience( newQuest, 666 );
        this.leavesQuestTools.addRewardItem( newQuest, "57347c5b245977448d35f6e1", 1, true );

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
            hasKillFailstate: -1,
            hasEquipment: -1,
            questID: newQuest._id,
            isEasyQuest: false,
        }

        const handoverIndex = this.leavesQuestTools.addHandOverObjectiveToQuest( newQuest, 1 );
        this.leavesQuestTools.generateHandoverItemLocale( newQuest.conditions.AvailableForFinish[ handoverIndex ], "", this.localizationChangesToSave );
        //this.leavesQuestTools.generateKillsLocale( newQuest.conditions.AvailableForFinish[ killIndex ], flags, this.localizationChangesToSave );
        for ( const locale of this.leavesUtils.getLoadedLocales() )
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
                this.localizationChangesToSave
            )
        }
        questDB[ newQuest._id ] = newQuest;
        this.leavesUtils.debugJsonOutput( newQuest );
    }

}