import { DependencyContainer } from "tsyringe";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { LeavesUtils } from "./LeavesUtils"
import { randomInt } from "node:crypto";

export class LeavesSettingsManager
{
    private config: any;
    private weaponCategories: any;
    private handoverCategories: any;
    private weaponCategoriesWeighting: any;
    private gearList: any;
    private localizationChanges: any;
    private bodyParts: string[][];
    private validTargets: string[];
    private validMaps: string[];
    private easyMaps: string[];
    private locationIDMap;
    private questWhiteList: string[];
    private rewardTable;

    private databaseServer: DatabaseServer

    constructor(
        private leavesUtils: LeavesUtils,
        container: DependencyContainer
    )
    {
        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );
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

        this.gearList = this.leavesUtils.loadFile( "assets/data/gearlist.jsonc" );

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
        this.weaponCategories = this.leavesUtils.loadFile( "assets/data/weaponcategories.jsonc" );

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
        const categoriesConfig = this.leavesUtils.loadFile( "assets/data/handovercategories.jsonc" );

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

    public getBodyParts():string[][]
    {
        return this.bodyParts;
    }

    public getBodypartSelection( ): string[]
    {
        const bodyPartsList = this.getBodyParts();
        const chosen = randomInt( bodyPartsList.length );
        return bodyPartsList[ chosen ];
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

    public getWeaponCategoriesWeighting()
    {
        return this.weaponCategoriesWeighting;
    }
    public getWeaponCategories()
    {
        return this.weaponCategories;
    }
    public getCategoriesWeaponIsPartOf( weaponID: string ): string[]
    {
        let categories: string[];
        for ( const categoryName of Object.keys( this.weaponCategories.categories ) )
        {
            if ( this.weaponCategories.categories[categoryName].weapons.includes(weaponID) )
            {
                categories.push(categoryName)
            }
        }
        return categories;
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