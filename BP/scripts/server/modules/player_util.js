import { World, Location, BlockLocation } from 'mojang-minecraft';
import { Server } from '../../library/Minecraft.js';
import { EventEmitter } from '../../library/build/classes/eventEmitter.js';
import { printDebug } from '../util.js';
class PlayerHandler extends EventEmitter {
    constructor() {
        super();
        this.playerDimensions = new Map();
        Server.on('tick', tick => {
            for (const entry of this.playerDimensions) {
                entry[1][0] = false;
            }
            for (const player of World.getPlayers()) {
                const oldDimension = this.playerDimensions.get(player.nameTag)?.[2];
                const newDimension = this.getDimension(player)[1];
                if (oldDimension && oldDimension != newDimension) {
                    this.emit('playerChangeDimension', player, newDimension);
                }
            }
        });
        this.on('playerChangeDimension', (player, dimension) => {
            printDebug(`${player.nameTag} has travelled to "${dimension}"`);
            const stasherName = 'wedit:stasher_for_' + player.nameTag.replace(' ', '_');
            Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name=${stasherName}] 0 512 0`, dimension);
        });
    }
    hasItem(player, item) {
        return !Server.runCommand(`clear "${player.nameTag}" ${item} 0 0`).error;
    }
    replaceItem(player, item, sub) {
        const inv = player.getComponent('inventory').container;
        for (let i = 0; i < inv.size; i++) {
            if (inv.getItem(i)?.id === item) {
                const slotType = i > 8 ? 'slot.inventory' : 'slot.hotbar';
                const slotId = i > 8 ? i - 9 : i;
                // printDebug(slotId);
                // printDebug(slotType);
                // printDebug(item + ' -> ' + sub);
                Server.runCommand(`replaceitem entity "${player.nameTag}" ${slotType} ${slotId} ${sub}`);
                break;
            }
        }
    }
    getBlockLocation(player) {
        return new BlockLocation(Math.floor(player.location.x), Math.floor(player.location.y), Math.floor(player.location.z));
    }
    requestDirection(player) {
        return new Promise((resolve) => {
            const locA = player.location;
            let locB;
            const [dimension, dimName] = this.getDimension(player);
            Server.runCommand(`execute "${player.nameTag}" ~~~ summon wedit:direction_marker ~~~`, dimName);
            let entity;
            for (const e of dimension.getEntitiesAtBlockLocation(this.getBlockLocation(player))) {
                if (e.id == 'wedit:direction_marker') {
                    entity = e;
                    entity.nameTag = 'wedit:direction_for_' + player.nameTag.replace(' ', '_');
                    break;
                }
            }
            Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name=${entity.nameTag}] ^^^20`, dimName);
            locB = entity.location;
            entity.nameTag = 'wedit:pending_deletion_of_selector';
            Server.runCommand(`execute @e[name=${entity.nameTag}] ~~~ tp @s ~ -256 ~`, dimName);
            entity.kill();
            let dir = [locB.x - locA.x, locB.y - locA.y, locB.z - locA.z];
            const len = Math.sqrt(dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]);
            dir = dir.map(v => { return v / len; });
            resolve(new Location(dir[0], dir[1], dir[2]));
        });
    }
    getDimension(player) {
        if (this.playerDimensions.get(player.nameTag)?.[0]) {
            return this.playerDimensions.get(player.nameTag).slice(1);
        }
        const blockLoc = this.getBlockLocation(player);
        for (const dimName of ['overworld', 'nether', 'the end']) {
            const dimension = World.getDimension(dimName);
            const entities = dimension.getEntitiesAtBlockLocation(blockLoc);
            for (const entity of entities) {
                if (entity.id == 'minecraft:player' && entity.nameTag == player.nameTag) {
                    this.playerDimensions.set(player.nameTag, [true, dimension, dimName]);
                    return [dimension, dimName];
                }
            }
        }
        return this.playerDimensions.get(player.nameTag).slice(1) || [null, null];
    }
    isHotbarStashed(player) {
        return !Server.runCommand(`testfor @e[type=wedit:inventory_stasher,name=wedit:stasher_for_${player.nameTag.replace(' ', '_')}]`).error;
    }
    stashHotbar(player) {
        if (this.isHotbarStashed(player)) {
            return true;
        }
        const stasher = this.getDimension(player)[0].spawnEntity('wedit:inventory_stasher', new BlockLocation(0, 512, 0));
        stasher.nameTag = 'wedit:stasher_for_' + player.nameTag.replace(' ', '_');
        const inv = player.getComponent('inventory').container;
        const inv_stash = stasher.getComponent('inventory').container;
        for (let i = 0; i < 9; i++) {
            inv.transferItem(i, i, inv_stash);
        }
        return false;
    }
    restoreHotbar(player) {
        let stasher;
        const dimension = this.getDimension(player)[1];
        const stasherName = 'wedit:stasher_for_' + player.nameTag.replace(' ', '_');
        Server.runCommand(`execute "${player.nameTag}" ~~~ tp @e[name=${stasherName}] 0 512 0`, dimension);
        for (const entity of World.getDimension(dimension).getEntitiesAtBlockLocation(new BlockLocation(0, 512, 0))) {
            if (entity.nameTag == stasherName) {
                stasher = entity;
                break;
            }
        }
        if (stasher) {
            const inv = player.getComponent('inventory').container;
            const inv_stash = stasher.getComponent('inventory').container;
            for (let i = 0; i < 9; i++) {
                if (inv.getItem(i) && inv_stash.getItem(i)) {
                    inv.swapItems(i, i, inv_stash);
                }
                else if (inv.getItem(i)) {
                    inv.transferItem(i, i, inv_stash);
                }
                else {
                    inv_stash.transferItem(i, i, inv);
                }
            }
            Server.runCommand(`tp @e[name=${stasherName}] 0 -256 0`, dimension);
            stasher.triggerEvent('wedit:kill');
            return false;
        }
        else {
            return true;
        }
    }
}
export const PlayerUtil = new PlayerHandler();
