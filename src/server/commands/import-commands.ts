import { Server } from '@library/Minecraft.js';
import { registerInformation } from '@library/@types/build/classes/CommandBuilder.js';
import { commandList, commandFunc } from './command_list.js';
import { assertBuilder } from '@modules/assert.js';
import { getSession, hasSession } from '../sessions.js';
import { Mask } from '@modules/mask.js';
import { Pattern } from '@modules/pattern.js';
import { Cardinal } from '@modules/directions.js';
import { Player } from 'mojang-minecraft';
import { print, printerr, printDebug } from '../util.js';
import { COMMAND_PREFIX } from '@config.js';

// TODO: Localization of all strings
// TODO: Throw proper syntax errors (commands.generic.syntax = Syntax error: Unexpected "%2$s": at "%1$s>>%2$s<<%3$s")

Server.command.addCustomArgType('Mask', Mask);
Server.command.addCustomArgType('Pattern', Pattern);
Server.command.addCustomArgType('Direction', Cardinal);

import './information/help.js';

import './selection/pos1.js';
import './selection/pos2.js';
import './selection/drawsel.js';
import './selection/desel.js';
import './selection/wand.js';

import './clipboard/cut.js';
import './clipboard/copy.js';
import './clipboard/paste.js';

import './generation/hsphere.js';
import './generation/sphere.js';
import './generation/cyl.js';
import './generation/hcyl.js';
import './generation/pyramid.js';
import './generation/hpyramid.js';

import './region/gmask.js';
import './region/set.js';
import './region/replace.js';
import './region/move.js';
import './region/stack.js';
// TODO: Implement wall
// TODO: Implement faces
// TODO: Implement hollow
// TODO: Implement line

import './navigation/navwand.js';
import './navigation/up.js';
import './navigation/unstuck.js';
import './navigation/jumpto.js';
import './navigation/thru.js';
// TODO: Implement ascend and descend
// TODO: Implement ceil

import './tool/tool.js';

import './brush/brush.js';
import './brush/mask.js';
import './brush/tracemask.js';
import './brush/size.js';
import './brush/range.js';
// TODO: Implement material

import './history/undo.js';
import './history/redo.js';
import './history/clearhistory.js';

Server.command.prefix = COMMAND_PREFIX;
let _printToActionBar = false;

for (const name in commandList) {
    const command = commandList[name];
    registerCommand(command[0], command[1]);
}

function registerCommand(cmd: registerInformation, callback: commandFunc) {
    Server.command.register(cmd, (data, args) => {
        let toActionBar = _printToActionBar;
        _printToActionBar = false;
        try {
            const player = data.sender;
            assertBuilder(player);
            const msg = callback(getSession(player), player, args);
            print(msg, player, toActionBar);
        } catch (e) {
            if (hasSession(data.sender.nameTag)) {
                const history = getSession(data.sender).getHistory();
                if (history.isRecording()) {
                    history.cancel();
                }
            }
            printerr(e, data.sender, toActionBar);
            if (e.stack) {
                printerr(e.stack, data.sender, false);
            }
        }
    });
}

export function printToActionBar() {
    _printToActionBar = true;
}
