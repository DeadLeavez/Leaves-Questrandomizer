import { inject, injectable } from "tsyringe";
import { DependencyContainer } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuest, IQuestCondition, IQuestConditionCounterCondition } from "@spt/models/eft/common/tables/IQuest";
import type { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { randomInt } from "crypto";
import { jsonc } from "jsonc";
import * as path from "node:path";
import { WeightedRandomHelper } from "@spt/helpers/WeightedRandomHelper";
import { HashUtil } from "@spt/utils/HashUtil";
import { HandbookHelper } from "@spt/helpers/HandbookHelper";


@injectable()
export class LeavesUtils
{
    private outputFolder: string;
    private tierList: any;
    private itemTiers: number[];

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger
    )
    {
        this.outputFolder = "";
    }


    public setOutputFolder( folder: string )
    {
        this.outputFolder = folder;
    }

    public setTierList( list: any )
    {
        this.tierList = list;
        this.generateItemTiers();
    }

    public loadFile( file: string ): any
    {
        const directoryFile = path.resolve( __dirname, `../${ file }` );
        //this.printColor( `${directoryFile }` );
        return jsonc.parse( this.vfs.readFile( directoryFile ) );
    }

    public saveFile( data: any, file: string )
    {
        const serialized = this.jsonUtil.serialize( data, true );
        //this.printColor( `${ this.outputFolder }${ file }` );
        this.vfs.writeFile( `${ this.outputFolder }${ file }`, serialized );
    }

    public dataDump()
    {
        const parents =
            [
                "-5448e54d4bdc2dcc718b4568", //Armor
                "5a341c4086f77401f2541505", //Headwear
                "-5448e5284bdc2dcb718b4567" //Vest
            ]
        const itemDB = this.databaseServer.getTables().templates.items;
        const locale = this.databaseServer.getTables().locales.global[ "en" ];
        for ( const item in itemDB )
        {
            if ( parents.includes( itemDB[ item ]._parent ) )
            {
                this.printColor( `"${ item }", //${ locale[ item + " Name" ] }` );
            }
        }
    }

    public printColor( message: string, color: LogTextColor = LogTextColor.GREEN )
    {
        this.logger.logWithColor( message, color );
    }

    public debugJsonOutput( jsonObject: any, label: string = "" )
    {
        if ( label.length > 0 )
        {
            this.logger.logWithColor( "[" + label + "]", LogTextColor.GREEN );
        }
        this.logger.logWithColor( JSON.stringify( jsonObject, null, 4 ), LogTextColor.MAGENTA );
    }

    //Uses set to guarantee unique values.
    public getUniqueValues<T>( array: T[], count: number ): T[]
    {
        if ( count > array.length )
        {
            count = array.length;
        }

        let generatedValues = new Set<T>();

        while ( generatedValues.size < count )
        {
            generatedValues.add( array[ randomInt( array.length ) ] );
        }

        return Array.from( generatedValues.values() );
    }

    public generateValueAdjustment( previousValue: number, factors: number[] ): number
    {
        const multiplier = 1 + ( Math.random() * factors[ 0 ] - Math.random() * factors[ 1 ] );
        const newValue = Math.round( previousValue * multiplier );
        if ( newValue < 1 )
        {
            return 1;
        }
        return newValue;
    }

    public searchObject( type: string, searchTarget: any )
    {
        //Hackiest shit ever
        if ( this.jsonUtil.serialize( searchTarget ).search( `${ type }` ) > -1 )
        {
            return true;
        }
        return false;
    }

    //Tier related stuff
    public getClosestTier( currentTier: number )
    {
        let closestDistance:number = Number.MAX_SAFE_INTEGER;
        let closestTier:number = Number.MAX_SAFE_INTEGER;
        for ( const tier of this.itemTiers )
        {
            const tempDistance = Math.abs( currentTier - tier );
            if ( tempDistance < closestDistance )
            {
                closestDistance = tempDistance;
                closestTier = tier;
            }
        }
        return closestTier;
    }

    public getRandomItemFromTier( tier: number ): string
    {
        let size = this.tierList[ tier ].length;

        return this.tierList[ tier ][ randomInt( size ) ];
    }
    public getTierFromID(  item: string ): number
    {
        for ( const tier in this.tierList )
        {
            if ( tier.includes( item ) )
            {
                return Number( tier );
            }
        }
        return -1;
    }

    private generateItemTiers()
    {
        this.itemTiers = [];
        for ( const tier in this.tierList )
        {
            this.itemTiers.push( Number( tier ) );
        }
    }

    public getLocale( locale: string, id: string, type: string = "" )
    {
        const localeDB = this.databaseServer.getTables().locales.global[ locale ];
        return localeDB[ `${ id }${ type }` ];
    }
}