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


@injectable()
export class LeavesUtils
{
    private modFolder: string;
    private tierList: any;
    private itemTiers: number[];
    private IDTranslator: any;
    private localization: any;
    private targetLocales: Set<string>;

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

    public setTierList( file: string )
    {
        this.tierList = this.loadFile( file );
        this.generateItemTiers();
    }

    public loadFile( file: string ): any
    {
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
        const questDB = this.databaseServer.getTables().templates.quests;
        let questList = "";
        for ( const quest in questDB )
        {
            questList += `"${ quest }", //${ questDB[ quest ].QuestName }\n`;
        }
        this.saveFile( questList, "debug/quests.jsonc", false );


        let target = {};
        this.printColor( "Starting dump of items" );
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
                this.debugJsonOutput( target );
                return;
            }
        }
        let serialized: string = this.jsonUtil.serialize( target, true );
        let lines: string[] = serialized.split( `\n` )
        let processed: string = "";
        for ( const line of lines )
        {
            processed += line;
            if ( line.indexOf( "\"" ) !== -1 )
            {
                const ID: string = this.getStringBetweenChars( line, "\"", "\"" );
                let locale = this.getLocale( "en", ID, " Name" );
                if ( locale === undefined )
                {
                    locale = this.databaseServer.getTables().templates.items[ ID ]._name;
                }
                processed += " //" + locale;
            }
            processed += "\n";
        }
        this.saveFile( processed, "debug/allItems.jsonc", false );

    }

    public getStringBetweenChars( original: string, char1: string, char2: string )
    {
        return original.substring(
            original.indexOf( char1 ) + 1,
            original.lastIndexOf( char2 )
        );
    }

    public printColor( message: string, color: LogTextColor = LogTextColor.GREEN )
    {
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
    public editLocaleText( targetID: string, newText: string, targetLocale: string, localizationChanges: any )
    {
        if ( !localizationChanges[ targetLocale ] )
        {
            localizationChanges[ targetLocale ] = {};
        }
        localizationChanges[ targetLocale ][ targetID ] = newText;
        this.databaseServer.getTables().locales.global[ targetLocale ][ targetID ] = newText;

        if ( targetLocale === "en" )
        {
            this.printColor( newText, LogTextColor.MAGENTA );
        }
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

    public hasParent( item: IItem, parent: string ): boolean
    {
        let current = item.parentId;

        while ( current !== "" )
        {
            current = this.databaseServer.getTables().templates.items[ current ]._parent;
            if ( current === parent )
            {
                return true;
            }
            if ( current === "" )
            {
                return false;
            }
        }
        return false;
    }

    private add( item: string, target: any )
    {
        let order: string[] = [];
        let current = item;
        const finalParent = this.databaseServer.getTables().templates.items[ item ]._parent;

        //Generate order
        do
        {
            current = this.databaseServer.getTables().templates.items[ current ]._parent;
            if ( current === "" )
            {
                break;
            }
            order.unshift( current );
        } while ( current != "" );

        //Re-generate the stack
        let tempTarget = target;
        for ( const toCheck of order )
        {
            if ( toCheck === finalParent )
            {
                if ( !tempTarget[ toCheck ] )
                {
                    tempTarget[ toCheck ] = {};
                }
                tempTarget[ toCheck ][ item ] = true;//`${ this.getLocale( "en", item, " Name" ) }`;
            }
            if ( !tempTarget[ toCheck ] )
            {
                tempTarget[ toCheck ] = {};
            }

            tempTarget = tempTarget[ toCheck ];
        }

        /*//this.leavesUtils.debugJsonOutput( target )

        const itemDB = this.databaseServer.getTables().templates.items;
        let parentName = this.getLocale( "en", itemDB[ item ]._parent, " Name" );
        if ( !target[ parentName ] )
        {
            target[ parentName ] = {};
        }
        target[ parentName ][ item ] = true;//`${ this.getLocale( "en", item, " Name" ) }`;*/
    }

    public loadLocalization( localeRoot: string )
    {
        this.localization = [];

        for ( const locale of this.getFoldersInFolder( localeRoot ) )
        {
            for ( const file of this.getFilesInFolder( `${ localeRoot }/${ locale }` ) )
            {
                this.localization[ locale ] = this.loadFile( `${ localeRoot }/${ locale }/${ file }` );
            }
        }

        //Set up locale system.
        this.targetLocales = new Set<string>();
        for ( const locale in this.localization )
        {
            this.targetLocales.add( locale );
        }
        for ( const language in this.databaseServer.getTables().locales.global )
        {
            this.targetLocales.add( language );
        }
    }

    public getLoadedLocales(): Set<string>
    {
        return this.targetLocales;
    }

    public getLoc( original: string, targetLocale ): string
    {
        if ( this.localization[ targetLocale ] && this.localization[ targetLocale ][ original ] )
        {
            return this.localization[ targetLocale ][ original ];
        }
        else
        {
            return this.localization[ "en" ][ original ];
        }
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