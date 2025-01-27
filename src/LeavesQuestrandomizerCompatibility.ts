import { inject, injectable } from "tsyringe";
import { LeavesQuestManager } from "./LeavesQuestManager";

@injectable()
export class LeavesQuestrandomizerCompatibility
{
    private leavesQuestManager: LeavesQuestManager
    constructor()
    {}

    public giveQuestManager( leavesQuestManager: LeavesQuestManager )
    {
        this.leavesQuestManager = leavesQuestManager;
    }

    public addWeaponEquivalent( originalWeapon: string, equivalentWeapon: string )
    {
        this.leavesQuestManager.addWeaponEquivalent( originalWeapon, equivalentWeapon );
    }
}