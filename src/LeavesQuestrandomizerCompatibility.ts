import { inject, injectable } from "tsyringe";
import { LeavesQuestManager } from "./LeavesQuestManager";

@injectable()
export class LeavesQuestrandomizerCompatibility
{
    constructor(
        @inject( "LeavesQuestManager") protected leavesQuestManager: LeavesQuestManager
    )
    {}

    public addWeaponEquivalent( originalWeapon: string, equivalentWeapon: string )
    {
        this.leavesQuestManager.addWeaponEquivalent( originalWeapon, equivalentWeapon );
    }
}