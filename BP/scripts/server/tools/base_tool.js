import { Server } from '../../library/Minecraft.js';
import { PlayerUtil } from '../modules/player_util.js';
import { print, printerr } from '../util.js';
// Note: Tools that define both use and useOn require to activate the same tag with '_block' appended when used on a block.
export class Tool {
    constructor() {
        // static readonly emptyUse = (player: Player, session: PlayerSession) => {};
        // static readonly emptyUseOn = (player: Player, session: PlayerSession, loc: BlockLocation) => {};
        this.useOnTick = 0;
    }
    log(message) {
        print(message, this.currentPlayer, true);
    }
    process(session, tick, loc) {
        const player = session.getPlayer();
        if (loc === undefined && this.itemBase !== undefined) {
            if (PlayerUtil.hasItem(player, this.itemBase) && !PlayerUtil.hasItem(player, this.itemTool)) {
                this.bind(player);
            }
        }
        if (!loc && !this.use || loc && !this.useOn) {
            return false;
        }
        const tag = (loc && this.useOn && this.use) ? this.tag + '_block' : this.tag;
        if (!Server.runCommand(`tag "${player.nameTag}" remove ${tag}`).error) {
            this.currentPlayer = player;
            try {
                if (loc === undefined) {
                    if (this.useOnTick != tick)
                        this.use(player, session);
                }
                else {
                    this.useOnTick = tick;
                    this.useOn(player, session, loc);
                }
            }
            catch (e) {
                printerr(e, player, true);
            }
            this.currentPlayer = null;
            return true;
        }
        return false;
    }
    bind(player) {
        PlayerUtil.replaceItem(player, this.itemBase, this.itemTool);
    }
    unbind(player) {
        if (PlayerUtil.hasItem(player, this.itemTool)) {
            if (this.itemBase) {
                PlayerUtil.replaceItem(player, this.itemTool, this.itemBase);
            }
            else {
                Server.runCommand(`clear "${player.nameTag}" ${this.itemTool}`);
            }
        }
    }
}
