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
    private currentContex: string;

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
        this.currentContex = "";
    }

    public getAllQuests(): any
    {
        return;
    }

    public switchContext( sessionId )
    {
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
        const profileID = this.profileHelper.getFullProfile( sessionId ).info?.id;

        if ( profileID === undefined || profileID === "undefined" || profileID === "" || profileID === null )
        {
            return;
        }

        if ( this.currentContex === profileID ) //If we're already in the context for that profile.
        {
            return;
        }

        this.leavesUtils.printColor( `[Questrandomizer] Switching context for PID:${ profileID } SID:${ sessionId }` );

        //We check in order of most likely to save performance, since this will be called a lot
        //Most likely: Everything is loaded.
        if ( this.quests[ profileID ] )
        {
            this.set( profileID );
            return;
        }

        //Not loaded, or generated. Time to generate new stuff.
        this.load( profileID );
        this.set( profileID );
    }

    private load( profileID )
    {
        let questDB = {};
        let localeChangesToSave = {};
        //Quests have been generated, but aren't loaded.
        if ( this.leavesUtils.checkIfFileExists( `assets/generated/${ profileID }/quests.json` ) )
        {
            questDB = this.leavesUtils.loadFile( `assets/generated/${ profileID }/quests.json` );
            localeChangesToSave = this.leavesUtils.loadFile( `assets/generated/${ profileID }/locales.json` );
            this.leavesSettingsManager.setLocalzationChangesToSave( localeChangesToSave );
        }

        //Get some fresh databases in here. 
        this.databaseServer.getTables().templates.quests = structuredClone( this.originalQuestDB );
        this.databaseServer.getTables().locales.global = structuredClone( this.originalLocaleDB );


        let questWhitelist: string[] = [];
        if ( this.leavesSettingsManager.getConfig().enableQuestWhilelist )
        {
            questWhitelist = this.leavesUtils.loadFile( "config/questwhitelist.jsonc" ).whitelist;
        }

        //Iterate the regular quest database see if any new quests are added.
        const serverQuestDB = this.databaseServer.getTables().templates.quests;
        let editedQuests = 0;
        let loadedQuests = Object.keys( questDB ).length;
        for ( const originalQuest in serverQuestDB )
        {
            //Check whitelist.
            if ( !questWhitelist.includes( originalQuest ) && this.leavesSettingsManager.getConfig().enableQuestWhilelist )
            {
                this.leavesUtils.printColor( `Ignoring:${ originalQuest } - ${ serverQuestDB[ originalQuest ].QuestName } due to not being on whitelist.`, LogTextColor.YELLOW, true );
                continue;
            }

            //Check if quest has been generated before.
            if ( !questDB[ originalQuest ] )
            {
                //If it hasn't, make get an edited copy of the quest.
                this.leavesUtils.printColor( `[Questrandomizer] Didn't find quest: ${ originalQuest }, ${ this.databaseServer.getTables().templates.quests[ originalQuest ]?.QuestName }, creating`, LogTextColor.GREEN, true )
                //Edit the quest

                questDB[ originalQuest ] = this.questRandomizer.editQuest( structuredClone( this.databaseServer.getTables().templates.quests[ originalQuest ] ) );
                editedQuests++;
            }
        }
        this.leavesUtils.printColor( "     ____     ____  ", LogTextColor.MAGENTA );
        this.leavesUtils.printColor( "    / __ \\   / __ \\", LogTextColor.MAGENTA );
        this.leavesUtils.printColor( "   / / / /  / /_/ /", LogTextColor.MAGENTA );
        this.leavesUtils.printColor( "  / /_/ /  / _, _/ ", LogTextColor.MAGENTA );
        this.leavesUtils.printColor( "  \\___\\_\\ /_/ |_|  Leaves Questrandomizer", LogTextColor.MAGENTA );
        this.leavesUtils.printColor( `┌──────────────────────────────────────────────────┐` );
        this.leavesUtils.printColor( `│ Found a total of ${ Object.keys( serverQuestDB ).length } quests in the game.`.padEnd( 51, ` ` ) + `│`, LogTextColor.GREEN );
        this.leavesUtils.printColor( `│ ----------------------------------------`.padEnd( 51, ` ` ) + `│`, LogTextColor.GREEN );
        this.leavesUtils.printColor( `│ Loaded:  ${ loadedQuests } already edited quests.`.padEnd( 51, ` ` ) + `│`, LogTextColor.GREEN );
        this.leavesUtils.printColor( `│ Edited:  ${ editedQuests } quests this launch.`.padEnd( 51, ` ` ) + `│`, LogTextColor.GREEN );
        this.leavesUtils.printColor( `│ Total:   ${ loadedQuests + editedQuests } quests changed from original.`.padEnd( 51, ` ` ) + `│`, LogTextColor.GREEN );
        this.leavesUtils.printColor( `└──────────────────────────────────────────────────┘` );

        //Load localization into the database.
        localeChangesToSave = this.leavesSettingsManager.getLocalizationChangesToSave();
        this.loadLocalizationIntoDatabase( localeChangesToSave );

        //Load quests into the database
        this.loadQuestsIntoDatabase( questDB );

        //Save expanded database into memory.
        this.quests[ profileID ] = structuredClone( this.databaseServer.getTables().templates.quests );
        this.locales[ profileID ] = structuredClone( this.databaseServer.getTables().locales.global );

        //Save the changes to file
        this.leavesUtils.saveFile( questDB, `assets/generated/${ profileID }/quests.json` );
        this.leavesUtils.saveFile( localeChangesToSave, `assets/generated/${ profileID }/locales.json` );
    }

    private loadQuestsIntoDatabase( questDB: any )
    {
        for ( const leavesQuestId in questDB )
        {
            const leavesQuest = questDB[ leavesQuestId ];

            this.databaseServer.getTables().templates.quests[ leavesQuestId ] = leavesQuest;
        }
    }

    private loadLocalizationIntoDatabase( localeChangesToSave: any )
    {
        let localeDB = this.databaseServer.getTables().locales.global;

        for ( const language in localeChangesToSave )
        {

            for ( const changeID in localeChangesToSave[ language ] )
            {
                if ( !localeDB[ language ] )
                {
                    localeDB[ language ] = {};
                }
                localeDB[ language ][ changeID ] = localeChangesToSave[ language ][ changeID ];
            }
        }
    }

    //This assumes profileID has been vetted and loaded.
    private set( profileID )
    {
        this.currentContex = profileID;
        this.databaseServer.getTables().locales.global = this.locales[ profileID ];
        this.databaseServer.getTables().templates.quests = this.quests[ profileID ];
    }

    public setQuestRandomizerReference( questRandomizer: Questrandomizer )
    {
        this.questRandomizer = questRandomizer;
    }
}