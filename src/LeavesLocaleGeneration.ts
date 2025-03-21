import { DependencyContainer } from "tsyringe";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { IQuestCondition } from "@spt/models/eft/common/tables/IQuest";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

//Helpers
import { LeavesUtils } from "./deps/LeavesUtils";
import { LeavesSettingsManager } from "./LeavesSettingsManager";

export class LeavesLocaleGeneration
{
    private loadedModLocalization;
    private weaponCategoriesLocalization;
    private targetLocales: Set<string>;

    private databaseServer: DatabaseServer;

    constructor(
        private leavesUtils: LeavesUtils,
        private leavesSettingsManager: LeavesSettingsManager,
        container: DependencyContainer
    )
    {
        this.databaseServer = container.resolve<DatabaseServer>( "DatabaseServer" );

        this.loadedModLocalization = [];
        this.weaponCategoriesLocalization = [];
        const localeRoot = "assets/data/localization";

        for ( const locale of this.leavesUtils.getFoldersInFolder( localeRoot ) )
        {
            for ( const file of this.leavesUtils.getFilesInFolder( `${ localeRoot }/${ locale }` ) )
            {
                if ( file === "base.json" )
                {
                    this.loadedModLocalization[ locale ] = this.leavesUtils.loadFile( `${ localeRoot }/${ locale }/${ file }` );
                }
                if ( file === "weaponCategories.json" )
                {
                    this.weaponCategoriesLocalization[ locale ] = this.leavesUtils.loadFile( `${ localeRoot }/${ locale }/${ file }` );
                }
            }
        }

        //Set up locale system.
        this.targetLocales = new Set<string>();
        for ( const locale in this.loadedModLocalization )
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

    public getWeaponCategoryLocale( category: string, targetLocale: string ): string
    {
        if ( this.weaponCategoriesLocalization[ targetLocale ] && this.weaponCategoriesLocalization[ targetLocale ][ category ] )
        {
            return this.weaponCategoriesLocalization[ targetLocale ][ category ];
        }
        else if ( this.weaponCategoriesLocalization[ "en" ][ category ] )
        {
            return this.weaponCategoriesLocalization[ "en" ][ category ];
        }

        return category;
    }

    public getLoc( original: string, targetLocale: string ): string
    {
        if ( this.loadedModLocalization[ targetLocale ] && this.loadedModLocalization[ targetLocale ][ original ] )
        {
            return this.loadedModLocalization[ targetLocale ][ original ];
        }
        else
        {
            return this.loadedModLocalization[ "en" ][ original ];
        }
    }

    public generateKillsLocale( task: IQuestCondition, flags: any )
    {
        for ( const targetLocale of this.getLoadedLocales() )
        {
            const kills = task.value as number;
            const conditions = task.counter.conditions;
            let target: string = "";
            if ( flags.hasSavageRole >= 0 )
            {
                for ( let role of conditions[ flags.hasKills ].savageRole ) 
                {
                    const targetTranslated = this.getLoc( role.toLocaleLowerCase(), targetLocale );
                    target += `${ targetTranslated } `;
                }
            }
            else
            {
                target = conditions[ flags.hasKills ].target as string;
                target = this.getLoc( target.toLocaleLowerCase(), targetLocale ) + " ";
            }

            let line: string = `${ this.getLoc( "Kill", targetLocale ) } ${ kills } ${ target }`;

            //Distance
            if ( flags.hasDistance >= 0 )
            {
                const distance = conditions[ flags.hasKills ].distance.compareMethod as string + " " + conditions[ flags.hasKills ].distance.value as string;
                line += `${ this.getLoc( "AtDistance", targetLocale ) } ${ distance }m `;
            }

            //Time of day //Skip if labs or factory
            if ( flags.hasTime >= 0 )
            {
                const start: string = ( conditions[ flags.hasKills ].daytime.from ).toString().padStart( 2, `0` );
                const finish: string = ( conditions[ flags.hasKills ].daytime.to ).toString().padStart( 2, `0` );
                line += `${ this.getLoc( "DuringTimeOfDay", targetLocale ) } ${ start }-${ finish } `;
            }

            //Weapon requirements
            if ( flags.hasWeapon >= 0 )
            {
                line += `${ this.getLoc( "usingWeaponGroup", targetLocale ) } `;
                if ( flags.hasSpecificWeapon >= 0 ) //Specific Weapon
                {
                    line += `${ this.leavesUtils.getLocale( targetLocale, flags.whatWeaponOrGroup, " Name" ) } `;
                }
                else //Weapon Group
                {
                    line += `${ this.getWeaponCategoryLocale( flags.whatWeaponOrGroup, targetLocale ) } `;
                }
            }

            //Body part hit requirement
            if ( flags.hasBodyparts >= 0 )
            {
                let bodyPartsLine = `${ this.getLoc( "inBodyPart", targetLocale ) }: [`;
                const bodyParts = conditions[ flags.hasKills ].bodyPart;
                for ( let i = 0; i < bodyParts.length; i++ )
                {
                    bodyPartsLine += `${ this.getLoc( bodyParts[ i ], targetLocale ) }`;
                    if ( i !== bodyParts.length - 1 )
                    {
                        bodyPartsLine += " or ";
                    }
                }
                bodyPartsLine += "] ";
                line += bodyPartsLine;
            }

            //Location
            if ( flags.hasLocation >= 0 )
            {
                let hasAddedGz = false;
                let mapsline = `${ this.getLoc( "atLocation", targetLocale ) } [`;
                for ( const map of conditions[ flags.hasLocation ].target )
                {
                    if ( map !== conditions[ flags.hasLocation ].target[ 0 ] )
                    {
                        if ( hasAddedGz === true && ( map.toLowerCase() === "sandbox" || map.toLowerCase() === "sandbox_high" ) )
                        { }
                        else
                        {
                            mapsline += ` or `;
                        }
                    }
                    if ( map.toLowerCase() === "sandbox" || map.toLowerCase() === "sandbox_high" )
                    {
                        if ( !hasAddedGz )
                        {
                            mapsline += `${ this.getLoc( "sandbox", targetLocale ) }`;
                            hasAddedGz = true;
                        }
                    }
                    else
                    {
                        mapsline += `${ this.getLoc( map.toLowerCase(), targetLocale ) }`;
                    }
                }
                mapsline += `] `;
                line += mapsline;
            }

            //Gear
            if ( flags.hasEquipment >= 0 )
            {
                line += `${ this.getLoc( "wearingGear", targetLocale ) }:\n`;
                let tempCount = 0;
                if ( conditions[ flags.hasEquipment ].equipmentInclusive ) 
                {
                    for ( const gearGroup of conditions[ flags.hasEquipment ].equipmentInclusive )
                    {
                        line += "[";
                        for ( const gearID of gearGroup )
                        {
                            let name = this.leavesUtils.getLocale( targetLocale, gearID, " Name" );
                            line += `${ name }`;
                        }
                        line += "]";

                        //Check if we're on the last line, so to not add extra |
                        if ( tempCount < conditions.length - 1 )
                        {
                            line += "|"
                        }
                        else
                        {
                            line += " ";
                        }

                        tempCount++;
                    }
                }
            }

            this.editLocaleText( task.id, line, targetLocale );
        }
    }

    public generateHandoverItemLocale( task: IQuestCondition, categoryName: string )
    {
        for ( const targetLocale of this.getLoadedLocales() )
        {
            let line = `${ this.getLoc( "HandoverItem", targetLocale ) } `; //Hand over
            line += `${ task.value } ${ this.getLoc( "ofItem", targetLocale ) }`; //x counts of
            if ( this.leavesSettingsManager.getConfig().rainbowifyFIR )
            {
                line += task.onlyFoundInRaid ?
                    this.leavesUtils.RTT_Rainbowify( `${ this.getLoc( "FoundInRaid", targetLocale ) } ` ) :
                    ``;
            }
            else
            {
                line += task.onlyFoundInRaid ?
                    this.leavesUtils.RTT_TFify( `${ this.getLoc( "FoundInRaid", targetLocale ) } ` ) :
                    ``;
            }
            //No category
            if ( categoryName === "" )
            {
                line += this.leavesUtils.getLocale( targetLocale, task.target[ 0 ], ` Name` );
            }
            else //We have a category
            {
                //Get category name.

                //Try the official DB
                let newName = this.leavesUtils.getLocale( targetLocale, categoryName, " Name" );

                //Else we check the local DB
                if ( newName == null )
                {
                    newName = this.getLoc( `ITEMCATEGORY_${ categoryName }`, targetLocale );
                }

                //If the local DB fails, we use the category name, as is.
                if ( newName == null )
                {
                    newName = categoryName;
                }

                line += `${ this.getLoc( "itemsFromThe", targetLocale ) } ` // items from the
                line += `${ newName } `;
                line += `${ this.getLoc( "Category", targetLocale ) } ` // category
            }

            this.editLocaleText( task.id, line, targetLocale );
        }
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
    public editLocaleText( targetID: string, newText: string, targetLocale: string )
    {
        if ( !this.leavesSettingsManager.getLocalizationChangesToSave()[ targetLocale ] )
        {
            this.leavesSettingsManager.getLocalizationChangesToSave()[ targetLocale ] = {};
        }
        this.leavesSettingsManager.getLocalizationChangesToSave()[ targetLocale ][ targetID ] = newText;
        this.databaseServer.getTables().locales.global[ targetLocale ][ targetID ] = newText;

        if ( targetLocale === "en" )
        {
            this.leavesUtils.printColor( newText, LogTextColor.MAGENTA, true );
        }
    }
    public addFullLocale( language: string, name: string, shortname: string, description: string, targetID: string )
    {
        this.addLocaleTo( language, name, `${ targetID } Name` );
        this.addLocaleTo( language, shortname, `${ targetID } ShortName` );
        this.addLocaleTo( language, description, `${ targetID } Description` );
    }

    public addWeaponGroupToWeapon( weaponGroup: string, weaponID: string )
    {
        for ( const locale in this.databaseServer.getTables().locales.global )
        {
            let desc = this.databaseServer.getTables().locales.global[ locale ][ `${ weaponID } Description` ];
            desc += `\n`;
            desc += this.leavesUtils.RTT_Bold( "{QR} " + this.getLoc( "PartOf", locale ) );
            desc += this.leavesUtils.RTT_Italic( " [" + this.getWeaponCategoryLocale( weaponGroup, locale ) + "]" );
            this.databaseServer.getTables().locales.global[ locale ][ `${ weaponID } Description` ] = desc;
        }
    }

    public addEquivalentToWeapon( originalID: string, equivalentID: string )
    {
        for ( const locale in this.databaseServer.getTables().locales.global )
        {
            let desc = this.databaseServer.getTables().locales.global[ locale ][ `${ equivalentID } Description` ];
            desc += `\n`;
            desc += this.leavesUtils.RTT_Bold( "{QR} " + this.getLoc( "EquivalentTo", locale ) );
            desc += this.leavesUtils.RTT_Italic( " [" + this.leavesUtils.getLocale( locale, originalID, " Name" ) + "]" );
            this.databaseServer.getTables().locales.global[ locale ][ `${ equivalentID } Description` ] = desc;
        }
    }
}