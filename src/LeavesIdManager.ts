import { DependencyContainer } from "tsyringe";
import { HashUtil } from "@spt/utils/HashUtil";
import { LeavesUtils } from "./deps/LeavesUtils";

export class LeavesIdManager
{
    private IDTranslator: any;
    private filepath: string;

    private hashUtils: HashUtil;

    constructor( container: DependencyContainer, private leavesUtils:LeavesUtils )
    {
        this.hashUtils = container.resolve<HashUtil>( "HashUtil" );
        this.leavesUtils = leavesUtils;
    }

    public load( filename: string )
    {
        this.filepath = filename;
        this.IDTranslator = this.leavesUtils.loadFile( filename );
    }
    public save() 
    {
        this.leavesUtils.saveFile( this.IDTranslator, this.filepath );
    }
    public get( name: string ): string
    {
        if ( !this.IDTranslator[ name ] )
        {
            this.IDTranslator[ name ] = this.hashUtils.generate();
        }
        return this.IDTranslator[ name ];
    }
}