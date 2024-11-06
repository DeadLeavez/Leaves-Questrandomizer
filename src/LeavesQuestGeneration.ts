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
        @inject( "LeavesQuestTools" ) protected leavesQuestTools:  LeavesQuestTools
    )
    { }

    private config: any;

    public setConfig( config: any )
    {
        this.config = config;
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
                Started: [],
                AvailableForFinish: [],
                AvailableForStart: [],
                Success: [],
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
            type: QuestTypeEnum.ELIMINATION,
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
    }


}