// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import ArrangeMenu from './arrangeMenu.js';

const HOTKEY_CASCADE = 'arrangewindow-cascade';
const HOTKEY_TILE = 'arrangewindow-tile';
const HOTKEY_SIDEBYSIDE = 'arrangewindow-sidebyside';
const HOTKEY_STACK = 'arrangewindow-stack';
const HOTKEY_MASTERLEFT = 'arrangewindow-masterleft';
const HOTKEY_MASTERRIGHT = 'arrangewindow-masterright';
const HOTKEY_MAXIMIZE = 'arrangewindow-maximize';
const HOTKEY_MAXIMIZE_VERTICAL = 'arrangewindow-maximizevertical';
const HOTKEY_MAXIMIZE_HORIZONTAL = 'arrangewindow-maximizehorizontal';
const HOTKEY_RESTORING = 'arrangewindow-restoring';

function addKeybinding(arrange, settings) {
    let modeType = Shell.ActionMode.NORMAL;

    Main.wm.addKeybinding(HOTKEY_CASCADE,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.cascadeWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_TILE,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.tileWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_SIDEBYSIDE,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.sideBySideWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_STACK,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.stackWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_MASTERLEFT,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.masterLeftWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_MASTERRIGHT,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.masterRightWindow.bind(arrange));
    Main.wm.addKeybinding(HOTKEY_MAXIMIZE,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          () => arrange.maximizeWindow(Meta.MaximizeFlags.BOTH));
    Main.wm.addKeybinding(HOTKEY_MAXIMIZE_VERTICAL,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          () => arrange.maximizeWindow(Meta.MaximizeFlags.VERTICAL));
    Main.wm.addKeybinding(HOTKEY_MAXIMIZE_HORIZONTAL,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          () => arrange.maximizeWindow(Meta.MaximizeFlags.HORIZONTAL));
    Main.wm.addKeybinding(HOTKEY_RESTORING,
                          settings,
                          Meta.KeyBindingFlags.NONE,
                          modeType,
                          arrange.restoringWindow.bind(arrange));
}

function removeKeybinding(){
    Main.wm.removeKeybinding(HOTKEY_CASCADE);
    Main.wm.removeKeybinding(HOTKEY_TILE);
    Main.wm.removeKeybinding(HOTKEY_SIDEBYSIDE);
    Main.wm.removeKeybinding(HOTKEY_STACK);
    Main.wm.removeKeybinding(HOTKEY_MASTERLEFT);
    Main.wm.removeKeybinding(HOTKEY_MASTERRIGHT);
    Main.wm.removeKeybinding(HOTKEY_MAXIMIZE);
    Main.wm.removeKeybinding(HOTKEY_MAXIMIZE_VERTICAL);
    Main.wm.removeKeybinding(HOTKEY_MAXIMIZE_HORIZONTAL);
    Main.wm.removeKeybinding(HOTKEY_RESTORING);
}

export default class ArrangeWindowsExtension extends Extension {

    enable() {
        this._settings = this.getSettings();
        this.arrange = new ArrangeMenu(this._settings, this.dir);
        Main.panel.addToStatusArea('arrange-menu', this.arrange);
        addKeybinding(this.arrange, this._settings);
    }

    disable() {
        removeKeybinding();
        this.arrange.destroy();
        this.arrange = null;
        this._settings = null;
    }
}
