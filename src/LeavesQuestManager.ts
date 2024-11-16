import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { VFS } from "@spt/utils/VFS";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HashUtil } from "@spt/utils/HashUtil";
import { LeavesUtils } from "./LeavesUtils";
import { ProfileHelper } from "@spt/helpers/ProfileHelper";
import { Questrandomizer } from "./mod";
import { LeavesSettingsManager } from "./LeavesSettingsManager";
import { LeavesQuestTools } from "./LeavesQuestTools";
import { LeavesIdManager } from "./LeavesIdManager";
import { LeavesQuestGeneration } from "./LeavesQuestGeneration";


@injectable()
export class LeavesQuestManager
{
    private originalQuestDB;
    private originalLocaleDB;
    private locales;
    private quests;
    private hasInit: boolean;
    private questRandomizer: Questrandomizer;
    private currentContex: string;
    private timeoutTracker: Set<String>;
    private unloadCheckTime: number;
    private weaponEquivalentTable: Record<string, string[]>;

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "WeightedRandomHelper" ) protected weightedRandomHelper: WeightedRandomHelper,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
        @inject( "ProfileHelper" ) protected profileHelper: ProfileHelper,
        @inject( "LeavesSettingsManager" ) protected leavesSettingsManager: LeavesSettingsManager,
        @inject( "LeavesQuestTools" ) protected leavesQuestTools: LeavesQuestTools,
        @inject( "LeavesIdManager" ) protected leavesIdManager: LeavesIdManager,
        @inject( "LeavesQuestGeneration" ) protected leavesQuestGeneration: LeavesQuestGeneration
    )
    {
        this.originalLocaleDB = {};
        this.originalQuestDB = {};
        this.locales = {};
        this.quests = {};
        this.hasInit = false;
        this.currentContex = "";
        this.timeoutTracker = new Set<String>();
        this.weaponEquivalentTable = {};
        this.unloadCheckTime = this.leavesSettingsManager.getConfig().timeBetweenUnloadChecks;
    }

    public addWeaponEquivalent( originalWeapon: string, equivalentWeapon: string )
    {
        if ( !this.weaponEquivalentTable[ originalWeapon ] )
        {
            this.weaponEquivalentTable[ originalWeapon ] = [];
        }
        this.weaponEquivalentTable[ originalWeapon ].push( equivalentWeapon );
    }

    public getWeaponEquivalentTable(): Record<string, string[]>
    {
        return this.weaponEquivalentTable;
    }

    public unloadChecker( timeSinceLastRun: number ): boolean
    {
        if ( timeSinceLastRun > this.unloadCheckTime )
        {
            for ( const profileID of Object.keys( this.quests ) )
            {
                if ( !this.timeoutTracker.has( profileID ) )
                {
                    const name = this.profileHelper.getFullProfile( profileID ).info.username;
                    this.leavesUtils.printColor( `[Questrandomizer] Unloading profile due to inactivity: ${ name } - ${ profileID }`, LogTextColor.YELLOW );
                    delete this.quests[ profileID ];
                    delete this.locales[ profileID ];
                }
            }
            this.timeoutTracker = new Set<String>();
            return true;
        }
        return false;
    }

    public switchContext( sessionId )
    {
        if ( this.hasInit === false )
        {
            this.leavesUtils.printColor( "Saving a copy of original DBs" );
            this.originalLocaleDB = structuredClone( this.databaseServer.getTables().locales.global );
            this.originalQuestDB = structuredClone( this.databaseServer.getTables().templates.quests );
            this.hasInit = true;
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
        }

        //Set changes, werther loaded or empty
        this.leavesSettingsManager.setLocalzationChangesToSave( localeChangesToSave );

        //Get some fresh databases in here. 
        this.databaseServer.getTables().templates.quests = structuredClone( this.originalQuestDB );
        this.databaseServer.getTables().locales.global = structuredClone( this.originalLocaleDB );


        let questWhitelist: string[] = [];
        if ( this.leavesSettingsManager.getConfig().enableQuestWhilelist )
        {
            questWhitelist = this.leavesSettingsManager.getQuestWhitelist();
        }

        //Iterate the regular quest database see if any new quests are added.
        const serverQuestDB = this.databaseServer.getTables().templates.quests;
        let editedQuests = 0;
        let loadedQuests = Object.keys( questDB ).length;
        const xpMulti = this.leavesSettingsManager.getConfig().questXPMultiplier;
        for ( const originalQuest in serverQuestDB )
        {
            //Xp multiplier
            this.leavesQuestTools.changeXPOnQuest( serverQuestDB[ originalQuest ], xpMulti );

            //Check trader whitelist
            const traderID = serverQuestDB[ originalQuest ].traderId;
            const traderName = this.leavesUtils.getTraderNickname( traderID );
            if ( this.leavesSettingsManager.getConfig().traderWhitelist.includes( traderID ) === false && this.leavesSettingsManager.getConfig().enableTraderWhitelist )
            {
                this.leavesUtils.printColor( `Ignoring:${ originalQuest } - ${ serverQuestDB[ originalQuest ].QuestName } due to trader ${ traderID } - ${ traderName } not being on whitelist.`, LogTextColor.YELLOW, true );
                continue;
            }
            //Check quest whitelist.
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

        //Quest Generation
        this.generateQuests( questDB );

        //Print logo + info
        this.printLogo( serverQuestDB, loadedQuests, editedQuests );

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
        this.leavesIdManager.save();
    }

    private generateQuests( questDB:any )
    {
        const questTrader = this.leavesSettingsManager.getConfig().QuestGen_Trader;
        let previousQuest = "";

        //Generate weapon mastery quests
        for ( let i = 0; i < this.leavesSettingsManager.getConfig().QuestGen_TotalWeaponQuests; ++i )
        {
            let questName = `WMQ_${ i }`;
            if ( !questDB[ this.leavesIdManager.get( questName ) ] )
            {
                this.leavesUtils.printColor( "[Questrandomizer]Generating quest: " + questName );
                let generatedQuest = this.leavesQuestGeneration.generateWeaponMasteryQuest( questName, previousQuest, questTrader, i );
                previousQuest = generatedQuest._id;
                questDB[ generatedQuest._id ] = generatedQuest;
            }
        }
    }

    private printLogo( serverQuestDB: any, loadedQuests: number, editedQuests: number )
    {
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
        this.timeoutTracker.add( profileID );
        this.currentContex = profileID;
        this.databaseServer.getTables().locales.global = this.locales[ profileID ];
        this.databaseServer.getTables().templates.quests = this.quests[ profileID ];
    }

    public setQuestRandomizerReference( questRandomizer: Questrandomizer )
    {
        this.questRandomizer = questRandomizer;
    }
}