import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { HashUtil } from "@spt/utils/HashUtil";
import { LeavesUtils } from "./LeavesUtils"
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";



@injectable()
export class LeavesSettingsManager
{
    private config: any;
    private weaponCategories: any;
    private handoverCategories: any;
    private weaponCategoriesWeighting: any;
    private gearList: any;
    private localizationChanges: any;
    private bodyParts: string[];
    private validTargets: string[];
    private validMaps: string[];
    private easyMaps: string[];
    private locationIDMap;
    private questWhiteList: string[];
    private rewardTable;

    constructor(
        @inject( "PreSptModLoader" ) protected preSptModLoader: PreSptModLoader,
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
    )
    {
        this.config = this.leavesUtils.loadFile( "config/config.jsonc" );

        //Load localization bundle
        this.localizationChanges = {};

        this.loadHandoverCategories();
        this.loadWeaponCategories();
        this.loadQuestWhitelists();

        const miscData = this.leavesUtils.loadFile( "assets/data/misc.jsonc" );
        this.locationIDMap = miscData.locationIdMap;
        this.validMaps = miscData.validMaps;
        this.validTargets = miscData.validTargets;
        this.bodyParts = miscData.bodyParts;
        this.easyMaps = miscData.easyMaps;
        this.rewardTable = miscData.rewards;

        this.gearList = this.leavesUtils.loadFile( "config/gearlist.jsonc" );

    }

    private loadQuestWhitelists()
    {
        const whitelistFolder = "config/questwhitelists/enabled/";
        this.questWhiteList = [];
        for ( const file of this.leavesUtils.getFilesInFolder( whitelistFolder ) )
        {
            this.leavesUtils.printColor( "loading: [" + whitelistFolder + file + "]" );
            let tempList: string[] = this.leavesUtils.loadFile( whitelistFolder + file ).whitelist;
            this.questWhiteList.push( ...tempList );
        }
    }

    public getQuestWhitelist()
    {
        return this.questWhiteList;
    }

    public getRewardsTable()
    {
        return this.rewardTable;
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
    }

    public getLocalizationChangesToSave()
    {
        return this.localizationChanges;
    }
    public setLocalzationChangesToSave( localizationChanges: any )
    {
        this.localizationChanges = localizationChanges;
    }

    public getGearList()
    {
        return this.gearList;
    }

    public getEasyMaps()
    {
        return this.easyMaps;
    }

    public getBodyParts()
    {
        return this.bodyParts;
    }

    public getBodypartSelection( count: number ): string[]
    {
        let tempArray = this.leavesUtils.getUniqueValues( this.getBodyParts(), count );
        let newArray = [];
        for ( const item of tempArray )
        {
            switch ( item )
            {
                case "Arms":
                    newArray.push( "LeftArm" );
                    newArray.push( "RightArm" );
                    break;
                case "Legs":
                    newArray.push( "LeftLeg" );
                    newArray.push( "RightLeg" );
                    break;
                default:
                    newArray.push( item );
                    break;
            }
        }
        return newArray;
    }

    public getValidTargets()
    {
        return this.validTargets;
    }

    public getValidMaps()
    {
        return this.validMaps;
    }

    public getLocationIDMap()
    {
        return this.locationIDMap;
    }

    public getweaponCategoriesWeighting()
    {
        return this.weaponCategoriesWeighting;
    }
    public getWeaponCategories()
    {
        return this.weaponCategories;
    }
    public gethandoverCategories()
    {
        return this.handoverCategories
    }
    public getConfig(): any
    {
        return this.config;
    }
}