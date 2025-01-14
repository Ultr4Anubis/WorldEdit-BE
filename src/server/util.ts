import { BlockLocation, Dimension, Entity, Location, Player, World } from 'mojang-minecraft';
import { DEBUG, PLAYER_HEIGHT, PRINT_TO_ACTION_BAR } from '../config.js';
import { dimension } from '@library/@types/index.js';
import { Server } from '@library/Minecraft.js';
import { RawText } from '@modules/rawtext.js';
import { PlayerUtil } from '@modules/player_util.js';

export type vector = [number, number, number];

// Server broadcast doesn't print anything until the first player has loaded.
let serverReady = false;
const printsPending: string[] = [];
Server.once('ready', ready => {
    serverReady = true;
    for (const msg of printsPending) {
        printDebug(msg);
    }
    printsPending.length = 0;
});

/**
 * Prints a message or object to chat for debugging.
 * @remark Doesn't do anything if {DEBUG} is disabled.
 * @param data The data to be printed to chat.
 */
export function printDebug(...data: any[]) {
    if (!DEBUG) {
        return;
    }

    let msg = '';
    data.forEach(data => {
        if (data instanceof BlockLocation || data instanceof Location) {
            msg += ' ' + printLocation(<BlockLocation> data);
        } else {
            msg += ` ${data}`;
        }
    });

    if (serverReady) {
        Server.broadcast('[DEBUG] ' + msg);
    } else {
        printsPending.push(msg);
    }
}

/**
 * Sends a message to a player through either chat or the action bar.
 * @param msg The message to send
 * @param player The one to send the message to
 * @param toActionBar If true the message goes to the player's action bar; otherwise it goes to chat
 */
export function print(msg: string | RawText, player: Player, toActionBar = false) {
    if (typeof msg == 'string') {
        msg = <RawText> RawText.text(msg);
    }
    let command: string;
    if (toActionBar && PRINT_TO_ACTION_BAR) {
        command = `titleraw "${player.nameTag}" actionbar ${msg.toString()}`;
    } else {
        command = `tellraw "${player.nameTag}" ${msg.toString()}`;
    }
    Server.runCommand(command);
}

/**
 * Acts just like {print} but also prepends a red code to make the message appear red.
 * @see {print}
 */
export function printerr(msg: string | RawText, player: Player, toActionBar = false) {
    print(msg instanceof RawText ? msg.prepend('text', '§c') : ('§c' + msg), player, toActionBar);
}

const worldY: {[k: string]: [number, number]} = {
    'overworld': [-999, 999],
    'nether': [0, 128],
    'the_end': [0, 128]
}
/**
 * Gets the minimum Y level of the dimension a player is in.
 * @param player The player we're testing
 * @return The minimum Y level of the dimension the player is in
 */
export function getWorldMinY(player: Player) {
    const dimName = PlayerUtil.getDimension(player)[1];
    // Caves and Cliffs?
    if (dimName == 'overworld' && worldY['overworld'][0] == -999) {
        const test = PlayerUtil.getBlockLocation(player);
        test.y = -1;
        worldY['overworld'][0] = canPlaceBlock(test, dimName) ? -64 : 0;
    }
    return worldY[dimName][0];
}

/**
 * Gets the maximum Y level of the dimension a player is in.
 * @param player The player we're testing
 * @return The maximum Y level of the dimension the player is in
 */
export function getWorldMaxY(player: Player) {
    const dimName = PlayerUtil.getDimension(player)[1];
    // Caves and Cliffs?
    if (dimName == 'overworld' && worldY['overworld'][1] == 999) {
        const test = PlayerUtil.getBlockLocation(player);
        test.y = 256;
        worldY['overworld'][1] = canPlaceBlock(test, dimName) ? 319 : 255;
    }
    return worldY[dimName][1];
}

/**
 * Tests if a block can be placed in a certain location of a dimension.
 * @param loc The location we are testing
 * @param dim The dimension we are testing in
 * @return Whether a block can be placed
 */
export function canPlaceBlock(loc: BlockLocation, dim: dimension) {
    const locString = printLocation(loc, false);
    Server.runCommand(`structure save canPlaceHere ${locString} ${locString} false memory`, dim);
    const error = Server.runCommand(`structure load canPlaceHere ${locString}`, dim).error;
    Server.runCommand(`structure delete canPlaceHere ${locString}`, dim);
    return !error;
}

/**
 * Converts a location object to a string.
 * @param loc The object to convert
 * @param pretty Whether the function should include brackets and commas in the string. Set to false if you're using this in a command.
 * @return A string representation of the location
 */
export function printLocation(loc: BlockLocation | Location, pretty = true) {
    if (pretty)
        return `(${loc.x}, ${loc.y}, ${loc.z})`;
    else
        return `${loc.x} ${loc.y} ${loc.z}`;
}

/**
 * Subtracts one location from another.
 * @param a The first location
 * @param b The second location
 * @return a - b
 */
export function subtractLocations(a: BlockLocation, b: BlockLocation) {
    return new BlockLocation(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * Adds one location with another.
 * @param a The first location
 * @param b The second location
 * @return a + b
 */
export function addLocations(a: BlockLocation, b: BlockLocation) {
    return new BlockLocation(a.x + b.x, a.y + b.y, a.z + b.z);
}

/**
 * Gives the volume of a space defined by two corners.
 * @param start The first location
 * @param end The second location
 * @return The volume of the space between start and end
 */
export function regionVolume(start: BlockLocation, end: BlockLocation) {
    const size = regionSize(start, end);
    return size.x * size.y * size.z;
}

/**
 * Calculates the minimum and maximum of a set of block locations
 * @param blocks The set of blocks
 * @return The minimum and maximum
 */
export function regionBounds(blocks: BlockLocation[]): [BlockLocation, BlockLocation] {
    let min = new BlockLocation(Infinity, Infinity, Infinity);
    let max = new BlockLocation(-Infinity, -Infinity, -Infinity);
    for (const block of blocks) {
        min = regionMin(min, block);
        max = regionMax(max, block);
    }
    return [min, max];
}

/**
 * Gets the minimum coordinates of a region.
 * @param start The first corner of the region
 * @param end The second corner of the region
 * @return The minimum coordinates of the region
 */
export function regionMin(start: BlockLocation, end: BlockLocation) {
    return new BlockLocation(Math.min(start.x, end.x), Math.min(start.y, end.y), Math.min(start.z, end.z));
}

/**
 * Gets the maximum coordinates of a region.
 * @param start The first corner of the region
 * @param end The second corner of the region
 * @return The maximum coordinates of the region
 */
export function regionMax(start: BlockLocation, end: BlockLocation) {
    return new BlockLocation(Math.max(start.x, end.x), Math.max(start.y, end.y), Math.max(start.z, end.z));
}

/**
 * Gets the size of a region across its three axis.
 * @param start The first corner of the region
 * @param end The second corner of the region
 * @return The size of the region
 */
export function regionSize(start: BlockLocation, end: BlockLocation) {
    return new BlockLocation(
        Math.abs(start.x - end.x) + 1,
        Math.abs(start.y - end.y) + 1,
        Math.abs(start.z - end.z) + 1
    );
}