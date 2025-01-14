import { BlockLocation, Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { printDebug, printLocation, regionMin, regionMax, regionSize, regionVolume, subtractLocations } from '../util.js';
import { RawText } from './rawtext.js';
import { PlayerUtil } from './player_util.js';

interface StructureMeta {
    subRegions?: [number, number, number][];
    position: BlockLocation;
    size: BlockLocation;
    origin: BlockLocation;
    blockCount: number;
}

class RegionsManager {
    private readonly MAX_SIZE: [number, number, number] = [64, 256, 64];
    
    private readonly structures = new Map<string, StructureMeta>();
    private readonly ids = new Map<string, string>();

    private genName(name: string, player: Player) {
        if (!this.ids.has(player.nameTag)) {
            do {
                var id = '';
                let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let charsLength = chars.length;
                for (let i = 0; i < 4; i++) {
                    id += chars.charAt(Math.floor(Math.random() * charsLength));
                }
            } while (Array.from(this.ids.values()).includes(id));
            this.ids.set(player.nameTag, id);
            printDebug(`Given "${player.nameTag}" a region ID of ${id}.`);
        }
        return `wedit:${name}_${this.ids.get(player.nameTag)}`;
    }
    
    save(name: string, start: BlockLocation, end: BlockLocation, player: Player, includeEntities = false) {
        const min = regionMin(start, end);
        const max = regionMax(start, end);
        const size = regionSize(start, end);
        const structName = this.genName(name, player);
        
        const dimension = PlayerUtil.getDimension(player)[1];
        
        if (size.x > this.MAX_SIZE[0] || size.y > this.MAX_SIZE[1] || size.z > this.MAX_SIZE[2]) {
            const subStructs: [number, number, number][] = [];
            for (let z = 0; z < size.z; z += this.MAX_SIZE[2])
            for (let y = 0; y < size.y; y += this.MAX_SIZE[1])
            for (let x = 0; x < size.x; x += this.MAX_SIZE[0]) {
                const subStart = printLocation(min.offset(x, y, z), false);
                const subEnd = printLocation(
                    regionMin(new BlockLocation(x, y, z).offset(...this.MAX_SIZE), size)
                    .offset(min.x - 1, min.y - 1, min.z - 1),
                    false
                );
                
                const subName = structName + `_${x}_${y}_${z}`;
                /* printDebug(subName);
                printDebug(subStart);
                printDebug(subEnd); */
                if (!Server.runCommand(`structure save ${subName} ${subStart} ${subEnd} ${includeEntities} memory`, dimension).error) {
                    subStructs.push([x, y, z]);
                } else {
                    for (const sub of subStructs) {
                        Server.runCommand(`structure delete ${structName}_${x}_${y}_${z}`);
                    }
                    return true;
                }
            }
            
            this.structures.set(structName, {
                subRegions: subStructs,
                position: min,
                size: size,
                origin: subtractLocations(PlayerUtil.getBlockLocation(player), min),
                blockCount: regionVolume(start, end)
            });
            return false;
        } else {
            const startStr = printLocation(min, false);
            const endStr = printLocation(max, false);
            /* printDebug(structName);
            printDebug(startStr);
            printDebug(endStr); */
            if (!Server.runCommand(`structure save ${structName} ${startStr} ${endStr} ${includeEntities} memory`, dimension).error) {
                this.structures.set(structName, {
                    position: min,
                    size: size,
                    origin: subtractLocations(PlayerUtil.getBlockLocation(player), min),
                    blockCount: regionVolume(start, end)
                });
                return false;
            }
        }
        return true;
    }
    
    load(name: string, location: BlockLocation, player: Player, mode: 'absolute' | 'relative') {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            const dimension = PlayerUtil.getDimension(player)[1];
            let loadPos = location;
            if (mode == 'relative') {
                loadPos = subtractLocations(location, struct.origin);
            }
            
            if (struct.subRegions) {
                let success = false;
                for (const sub of struct.subRegions) {
                    const subLoad = printLocation(loadPos.offset(...sub), false);
                    //printDebug(`${structName}_${sub[0]}_${sub[1]}_${sub[2]}`);
                    //printDebug(subLoad);
                    const s = !Server.runCommand(`structure load ${structName}_${sub[0]}_${sub[1]}_${sub[2]} ${subLoad}`, dimension).error;
                    //printDebug(s);
                    success ||= s;
                }
                return !success;
            } else {
                return Server.runCommand(`structure load ${structName} ${printLocation(loadPos, false)}`, dimension).error;
            }
        }
        return true;
    }
    
    has(name: string, player: Player) {
        return this.structures.has(this.genName(name, player));
    }

    delete(name: string, player: Player) {
        const structName = this.genName(name, player);
        const struct = this.structures.get(structName);
        if (struct) {
            let error = false;
            if (struct.subRegions) {
                for (const sub of struct.subRegions) {
                    error ||= !Server.runCommand(`structure delete ${structName}_${sub[0]}_${sub[1]}_${sub[2]}`).error;
                }
            } else {
                error = Server.runCommand(`structure delete ${structName}`).error;
            }
            this.structures.delete(structName);
            return error;
        }
        return true;
    }
    
    deletePlayer(player: Player) {
        this.structures.forEach((_, struct) => {
            if (struct.endsWith('_' + this.ids.get(player.nameTag))) {
                const error = Server.runCommand(`structure delete ${struct}`).error;
                if (error) {
                    return true;
                }
                this.structures.delete(struct);
            }
        });
        this.ids.delete(player.nameTag);
        return false;
    }

    getOrigin(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).origin;
    }

    getPosition(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).position;
    }

    getSize(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).size;
    }

    getBlockCount(name: string, player: Player) {
        return this.structures.get(this.genName(name, player)).blockCount;
    }
}

export const Regions = new RegionsManager();
