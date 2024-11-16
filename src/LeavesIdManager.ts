import { inject, injectable } from "tsyringe";
import { HashUtil } from "@spt/utils/HashUtil";
import { LeavesUtils } from "./LeavesUtils";

@injectable()
export class LeavesIdManager
{
    private IDTranslator: any;
    private filepath: string;

    constructor(
        @inject( "HashUtil" ) protected hashUtil: HashUtil,
        @inject( "LeavesUtils" ) protected leavesUtils: LeavesUtils,
    )
    {}

    public load( filename: string )
    {
        this.filepath = filename;
        this.IDTranslator = this.leavesUtils.loadFile( filename );
    }
    public save( ) 
    {
        this.leavesUtils.saveFile( this.IDTranslator, this.filepath );
    }
    public get( name: string ): string
    {
        if ( !this.IDTranslator[ name ] )
        {
            this.IDTranslator[ name ] = this.hashUtil.generate();
        }

        return this.IDTranslator[ name ];
    }
}