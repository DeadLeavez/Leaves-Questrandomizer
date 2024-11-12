import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { VFS } from "@spt/utils/VFS";
import { randomInt } from "crypto";
import { jsonc } from "jsonc";
import * as path from "node:path";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HashUtil } from "@spt/utils/HashUtil";
import { IItem } from "@spt/models/eft/common/tables/IItem";
import { LeavesUtils } from "./LeavesUtils";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { Questrandomizer } from "./mod";
import { LeavesSettingsManager } from "./LeavesSettingsManager";

@injectable()
export class LeavesContextSwitcher
{
    private originalQuestDB;
    private originalLocaleDB;
    private locales;
    private quests;
    private hasInit: boolean;
    private questRandomizer: Questrandomizer;
    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "WeightedRandomHelper" ) protected weightedRandomHelper: WeightedRandomHelper,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
        @inject( "ProfileHelper" ) protected profileHelper: ProfileHelper,
        @inject( "LeavesSettingsManager" ) protected leavesSettingsManager: LeavesSettingsManager
    )
    {
        this.locales = {};
        this.quests = {};
        this.hasInit = false;
    }

    public switchContext( sessionId )
    {
        this.leavesUtils.printColor( "SESSID:" + sessionId );
        if ( !this.hasInit )
        {
            this.hasInit = true;
            this.originalLocaleDB = structuredClone( this.databaseServer.getTables().locales.global );
            this.originalQuestDB = structuredClone( this.databaseServer.getTables().templates.quests );
        }

        if ( sessionId === undefined || sessionId === "undefined" || sessionId === "" || sessionId === null )
        {
            return;
        }
        const profileID = this.profileHelper.getPmcProfile( sessionId )._id;

        if ( profileID === undefined || profileID === "undefined" || profileID === "" || profileID === null )
        {
            return;
        }

        this.leavesUtils.printColor( "GOT A PROPER PROFILE: " + profileID );
        this.leavesUtils.printColor( "SETTING!" );

        //We check in order of most likely to save performance, since this will be called a lot
        //Most likely: Everything is loaded.
        if ( this.quests[ profileID ] )
        {
            this.set( profileID );
            return;
        }

        //Quests have been generated, but aren't loaded.
        if ( this.leavesUtils.checkIfFileExists( `assets/generated/${ profileID }/quests.json` ) )
        {
            this.quests[ profileID ] = this.leavesUtils.loadFile( `assets/generated/${ profileID }/quests.json` );
            this.locales[ profileID ] = this.leavesUtils.loadFile( `assets/generated/${ profileID }/locales.json` );
            this.set( profileID );
            return;
        }

        //Not loaded, or generated. Time to generate new stuff.
        this.generate( profileID );
        this.set( profileID );
    }

    private generate( profileID )
    {
        this.databaseServer.getTables().templates.quests = structuredClone( this.originalQuestDB );
        this.databaseServer.getTables().locales.global = structuredClone( this.originalLocaleDB );

        let QuestDB = {};
        let questWhitelist: string[] = [];
        if ( this.leavesSettingsManager.getConfig().enableQuestWhilelist )
        {
            questWhitelist = this.leavesUtils.loadFile( "config/questwhitelist.jsonc" ).whitelist;
        }

        //Iterate the regular quest database see if any new quests are added.
        const serverQuestDB = this.databaseServer.getTables().templates.quests;
        for ( const originalQuest in serverQuestDB )
        {
            //Check whitelist.
            if ( !questWhitelist.includes( originalQuest ) && this.leavesSettingsManager.getConfig().enableQuestWhilelist )
            {
                this.leavesUtils.printColor( `Ignoring:${ originalQuest } - ${ serverQuestDB[ originalQuest ].QuestName } due to not being on whitelist.` );
                continue;
            }

            //Check if quest has been generated before.
            if ( !QuestDB[ originalQuest ] )
            {
                //If it hasn't, make get an edited copy of the quest.
                this.leavesUtils.printColor( `[Questrandomizer] Didn't find quest: ${ originalQuest }, ${ this.databaseServer.getTables().templates.quests[ originalQuest ]?.QuestName }, creating` )
                //Edit the quest

                QuestDB[ originalQuest ] = this.questRandomizer.editQuest( structuredClone( this.databaseServer.getTables().templates.quests[ originalQuest ] ) );
            }
        }

        //We're done with checking, so now we override the original quest DB with our new quests.
        for ( const leavesQuestId in QuestDB )
        {
            const leavesQuest = QuestDB[ leavesQuestId ];

            this.databaseServer.getTables().templates.quests[ leavesQuestId ] = leavesQuest;
        }

        this.quests[ profileID ] = structuredClone( this.databaseServer.getTables().templates.quests );
        this.locales[ profileID ] = structuredClone( this.databaseServer.getTables().locales.global );

        this.leavesUtils.saveFile( this.quests[ profileID ], `assets/generated/${ profileID }/quests.json` );
        this.leavesUtils.saveFile( this.locales[ profileID ], `assets/generated/${ profileID }/locales.json` );
    }

    //This assumes profileID has been vetted and loaded.
    private set( profileID )
    {
        this.databaseServer.getTables().locales.global = this.locales[ profileID ];
        this.databaseServer.getTables().templates.quests = this.quests[ profileID ];
    }

    public setQuestRandomizerReference( questRandomizer: Questrandomizer )
    {
        this.questRandomizer = questRandomizer;
    }
}