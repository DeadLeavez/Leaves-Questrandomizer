import path from "node:path";
import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { LeavesUtils } from "./LeavesUtils"
import packageJson from "../package.json";
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";

class ModSettings
{

}

@injectable()
export class LeavesSettingsManager
{

    //WE WANNA MOVE THESE
    public config: any;
    public weaponCategories: any;
    public handoverCategories: any;
    public weaponCategoriesWeighting: any;
    public gearList: any;
    public localizationChangesToSave: any;
    public bodyParts: string[];
    public validTargets: string[];
    public validMaps: string[];
    public easyMaps: string[];
    public locationIdMap;
    //END

    constructor(
        @inject( "PreSptModLoader" ) protected preSptModLoader: PreSptModLoader,
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
    )
    {
        this.config = this.leavesUtils.loadFile( "config/config.jsonc" );
        this.loadHandoverCategories();
        this.loadWeaponCategories();
    }


    private loadWeaponCategories()
    {
        //Load the file
        this.weaponCategories = this.leavesUtils.loadFile( "config/weaponcategories.jsonc" );

        //Load the weightings
        this.weaponCategoriesWeighting = {};
        for ( let category in this.weaponCategories.categories )
        {
            this.weaponCategoriesWeighting[ category ] = this.weaponCategories.categories[ category ].weight;
        }
    }

    private loadHandoverCategories()
    {
        //Load the file
        const categoriesConfig = this.leavesUtils.loadFile( "config/handovercategories.jsonc" );

        //Populate handover categories.
        this.handoverCategories = {};

        //Add the whitelist
        for ( const category of categoriesConfig.categoryWhitelist )
        {
            this.handoverCategories[ category ] = [];
        }

        //Add the custom lists
        for ( const customCategory in categoriesConfig.customCategories )
        {
            this.handoverCategories[ customCategory ] = categoriesConfig.customCategories[ customCategory ];
        }

        const itemDB = this.databaseServer.getTables().templates.items;

        //Get all items from categories
        for ( let item in itemDB )
        {
            //Check if its a bad item
            if ( !this.leavesUtils.isProperItem( item ) )
            {
                continue;
            }
            const itemObject = itemDB[ item ];
            if ( this.handoverCategories.hasOwnProperty( itemObject._parent ) )
            {
                this.handoverCategories[ itemObject._parent ].push( itemObject._id );
            }
        }

        //this.leavesUtils.debugJsonOutput( this.handoverCategories );
    }

    public getConfig(): any
    {
        return this.config;
    }

    public setLocalizationChanges( localizationChanges: any )
    {
        this.config.localizationChangesToSave = localizationChanges;
    }
}