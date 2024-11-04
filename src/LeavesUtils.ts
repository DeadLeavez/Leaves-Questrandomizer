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


@injectable()
export class LeavesUtils
{
    private modFolder: string;
    private tierList: any;
    private itemTiers: number[];
    private IDTranslator: any;

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "WeightedRandomHelper" ) protected weightedRandomHelper: WeightedRandomHelper,
        @inject( "HashUtil" ) protected hashUtil: HashUtil
    )
    {
        this.modFolder = path.resolve( __dirname, `../` );
    }


    public setModFolder( folder: string )
    {
        this.modFolder = folder;
    }

    public setTierList( list: any )
    {
        this.tierList = list;
        this.generateItemTiers();
    }

    public loadFile( file: string ): any
    {
        //const directoryFile = path.resolve( __dirname, `../${ file }` );
        //this.printColor( `${directoryFile }` );
        return jsonc.parse( this.vfs.readFile( this.modFolder + file ) );
    }

    public getFoldersInFolder( folder: string ): string[]
    {
        return this.vfs.getDirs( this.modFolder + folder );
    }

    public getFilesInFolder( folder: string ): string[]
    {
        return this.vfs.getFiles( this.modFolder + folder );
    }

    public getFileWithoutExtension( file: string ): string
    {
        return this.vfs.stripExtension( file );
    }

    public saveFile( data: any, file: string, serialize: boolean = true )
    {
        let dataCopy = structuredClone( data );

        if ( serialize )
        {
            dataCopy = this.jsonUtil.serialize( data, true );
        }

        this.vfs.writeFile( `${ this.modFolder }${ file }`, dataCopy );
    }

    public dataDump()
    {
        //Dump gear
        /*const parents =
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
        }*/
        const questDB = this.databaseServer.getTables().templates.quests;
        for ( const quest in questDB )
        {
            this.printColor( `"${ quest }", //${ questDB[ quest ].QuestName }` );
        }

        //
        /*const TempArr = [ "5447a9cd4bdc2dbd208b4567", "5bfd297f0db834001a669119", "5c0530ee86f774697952d952" ];
        let target = {};
        this.leavesUtils.printColor( "Starting dump of items" );
        for ( let item in this.databaseServer.getTables().templates.items )
        {
            const type = this.databaseServer.getTables().templates.items[ item ]._type;
            try
            {
                if ( type === "Item" )
                {
                    this.add( item, target );
                }
            }
            catch ( e )
            {
                this.leavesUtils.debugJsonOutput( target );
                return;
            }
        }
        this.leavesUtils.debugJsonOutput( target );
        */
    }

    public printColor( message: string, color: LogTextColor = LogTextColor.GREEN )
    {
        //this.logger.logWithColor( message, color );
        //this.logger.debug( message );
        this.logger.log( message, color );
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

    public getUniqueWeightedValues<T>( weightedArray: any, count: number ): T[]
    {
        if ( count > Object.keys( weightedArray ).length )
        {
            count = Object.keys( weightedArray ).length;
        }

        let generatedValues = new Set<T>();

        while ( generatedValues.size < count )
        {
            generatedValues.add( this.weightedRandomHelper.getWeightedValue( weightedArray ) );
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
        let closestDistance: number = Number.MAX_SAFE_INTEGER;
        let closestTier: number = Number.MAX_SAFE_INTEGER;
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
    public getTierFromID( item: string ): number
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
        let localeDB;
        if ( this.databaseServer.getTables().locales.global[ locale ] )
        {
            localeDB = this.databaseServer.getTables().locales.global[ locale ];
        }
        else
        {
            localeDB = this.databaseServer.getTables().locales.global[ "en" ];
        }

        if ( !localeDB[ `${ id }${ type }` ] )
        {
            localeDB = this.databaseServer.getTables().locales.global[ "en" ];
        }

        return localeDB[ `${ id }${ type }` ];
    }
    public addLocaleToAll( text: string, id: string )
    {
        for ( const locale in this.databaseServer.getTables().locales.global )
        {
            this.databaseServer.getTables().locales.global[ locale ][ id ] = text;
        }
    }
    public addLocaleTo( targetLocale: string, text: string, id: string )
    {
        this.databaseServer.getTables().locales.global[ targetLocale ][ id ] = text;
    }
    public addFullLocale( language: string, name: string, shortname: string, description: string, targetID: string )
    {
        this.addLocaleTo( language, name, `${ targetID } Name` );
        this.addLocaleTo( language, shortname, `${ targetID } ShortName` );
        this.addLocaleTo( language, description, `${ targetID } Description` );
    }
    public isProperItem( item: string ): boolean
    {
        const itemDB = this.databaseServer.getTables().templates.items;

        //Does it even exist?
        if ( !itemDB[ item ] )
        {
            return false;
        }
        const itemObject = itemDB[ item ];
        //Does is it a type of item even?
        if ( itemObject._type !== "Item" )
        {
            return false;
        }
        //Does it have props?
        if ( !itemObject._props )
        {
            return false;
        }
        //Is it a quest item?
        if ( itemObject._props.QuestItem )
        {
            return false;
        }
        return true;
    }
    public loadIDs( filename: string )
    {
        this.IDTranslator = this.loadFile( filename );
    }
    public saveIDs( filename: string ) 
    {
        this.saveFile( this.IDTranslator, filename );
    }
    public getID( name: string ): string
    {
        // this.debugJsonOutput( this.IDTranslator );
        if ( !this.IDTranslator[ name ] )
        {
            this.IDTranslator[ name ] = this.hashUtil.generate();
        }
        return this.IDTranslator[ name ];
    }

    public RTT_Underline( original: string ): string
    {
        return `<underline>${ original }</underline>`;
    }
    public RTT_Rotate( original: string, angle: number ): string
    {
        return `<rotate="${ angle }">${ original }</rotate>`;
    }
    public RTT_Align( original: string, alignment: string ): string
    {
        return `<align="${ alignment }">${ original }<align>`;
    }
    public RTT_Bold( original: string ): string
    {
        return `<b>${ original }</b>`;
    }
    public RTT_Italic( original: string ): string
    {
        return `<i>${ original }</i>`;
    }
    public RTT_Color( original: string, color: string ): string
    {
        if ( color.length === 0 )
        {
            return original;
        }
        if ( color.at( 0 ) === `#` )
        {
            return `<color=${ color }>${ original }</color>`;
        }
        else
        {
            return `<color="${ color }">${ original }</color>`;
        }
    }
    public RTT_Rainbowify( original: string ): string
    {
        let newString = "";
        const step = 1 / original.length;
        let start = 0;
        for ( let char of original )
        {
            let color = this.HSVtoRGB( start, 1, 1 );
            let hexstring = `#${ color.r.toString( 16 ).padStart( 2, `0` ) }${ color.g.toString( 16 ).padStart( 2, `0` ) }${ color.b.toString( 16 ).padStart( 2, `0` ) }`;
            newString += this.RTT_Color( char, hexstring );
            start += step;
        }
        return newString;
    }
    public RTT_Size( original: string, size: string ): string
    {
        return `<size=${ size }>${ original }</size>`;
    }
    /*
    https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
    */
    public HSVtoRGB( h, s, v )
    {
        var r, g, b, i, f, p, q, t;
        if ( arguments.length === 1 )
        {
            s = h.s, v = h.v, h = h.h;
        }
        i = Math.floor( h * 6 );
        f = h * 6 - i;
        p = v * ( 1 - s );
        q = v * ( 1 - f * s );
        t = v * ( 1 - ( 1 - f ) * s );
        switch ( i % 6 )
        {
            case 0: r = v, g = t, b = p; break;
            case 1: r = q, g = v, b = p; break;
            case 2: r = p, g = v, b = t; break;
            case 3: r = p, g = q, b = v; break;
            case 4: r = t, g = p, b = v; break;
            case 5: r = v, g = p, b = q; break;
        }
        return {
            r: Math.round( r * 255 ),
            g: Math.round( g * 255 ),
            b: Math.round( b * 255 )
        };
    }
    
}
export const RTT_Align =
{
    LEFT: "left",
    CENTER: "center",
    RIGHT: "right",
    JUSTIFIED: "justified",
    FLUSH: "flush"
};
export const RTT_Colors =
{
    BLACK: "black",
    BLUE: "blue",
    GREEN: "green",
    ORANGE: "orange",
    PURPLE: "purple",
    RED: "red",
    WHITE: "white"
};