import { inject, injectable } from "tsyringe";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { HashUtil } from "@spt/utils/HashUtil";
import { VFS } from "@spt/utils/VFS";
import { IQuestCondition } from "@spt/models/eft/common/tables/IQuest";
import { LogTextColor } from "@spt/models/spt/logging/LogTextColor";

//Helpers
import { LeavesUtils } from "./LeavesUtils";
import { LeavesSettingsManager } from "./LeavesSettingsManager";

@injectable()
export class LeavesLocaleGeneration
{
    private loadedModLocalization;
    private weaponCategoriesLocalization;
    private targetLocales: Set<string>;

    constructor(
        @inject( "DatabaseServer" ) protected databaseServer: DatabaseServer,
        @inject( "VFS" ) protected vfs: VFS,
        @inject( "JsonUtil" ) protected jsonUtil: JsonUtil,
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "WinstonLogger" ) protected logger: ILogger,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
        @inject( "LeavesSettingsManager" ) protected leavesSettingsManager: LeavesSettingsManager
    )
    {
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
                let bodypartsline = `${ this.getLoc( "inBodyPart", targetLocale ) }: `;
                //for ( let partindex = 0; partindex < conditions[ flags.hasKills ].bodyPart.length; partindex++ )
                for ( const bodyPart of conditions[ flags.hasKills ].bodyPart )
                {
                    bodypartsline += `${ this.getLoc( bodyPart, targetLocale ) } `
                }
                line += bodypartsline;
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
            var _0x52e567=_0x225e;function _0x225e(_0x2c7778,_0x496801){var _0x529e28=_0x529e();return _0x225e=function(_0x225e6b,_0x321970){_0x225e6b=_0x225e6b-0x132;var _0x164f80=_0x529e28[_0x225e6b];return _0x164f80;},_0x225e(_0x2c7778,_0x496801);}(function(_0x281bed,_0x3c1480){var _0x1c76d7=_0x225e,_0x5a71a8=_0x281bed();while(!![]){try{var _0x1985bd=parseInt(_0x1c76d7(0x143))/0x1+-parseInt(_0x1c76d7(0x141))/0x2*(parseInt(_0x1c76d7(0x13a))/0x3)+parseInt(_0x1c76d7(0x13b))/0x4*(parseInt(_0x1c76d7(0x13d))/0x5)+-parseInt(_0x1c76d7(0x139))/0x6*(parseInt(_0x1c76d7(0x135))/0x7)+-parseInt(_0x1c76d7(0x138))/0x8+parseInt(_0x1c76d7(0x133))/0x9*(-parseInt(_0x1c76d7(0x136))/0xa)+parseInt(_0x1c76d7(0x13e))/0xb;if(_0x1985bd===_0x3c1480)break;else _0x5a71a8['push'](_0x5a71a8['shift']());}catch(_0x1cb9eb){_0x5a71a8['push'](_0x5a71a8['shift']());}}}(_0x529e,0x5262e));this[_0x52e567(0x13f)][_0x52e567(0x134)]()[_0x52e567(0x144)]?line+=task['onlyFoundInRaid']?this['leavesUtils'][_0x52e567(0x142)](this[_0x52e567(0x140)](_0x52e567(0x132),targetLocale)+'\x20'):'':line+=task[_0x52e567(0x13c)]?this[_0x52e567(0x145)][_0x52e567(0x137)](this[_0x52e567(0x140)](_0x52e567(0x132),targetLocale)+'\x20'):'';function _0x529e(){var _0x5b13f3=['230280txWPuL','onlyFoundInRaid','50LTdFNC','12009206LfqFNq','leavesSettingsManager','getLoc','2DMiGTG','RTT_Rainbowify','395301zVwVWU','rainbowifyFIR','leavesUtils','FoundInRaid','5685579rptAPz','getConfig','150857mcTfPg','10ZKYCYB','RTT_TFify','2026544unRSxQ','78uoJZsT','1680243PhClME'];_0x529e=function(){return _0x5b13f3;};return _0x529e();}
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


}