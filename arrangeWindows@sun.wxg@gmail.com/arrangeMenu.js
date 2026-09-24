// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import {gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import {SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

const CASCADE_WIDTH = 30;
const CASCADE_HEIGHT = 30;
const MIN_WINDOW_WIDTH = 500;

const ALL_MONITOR = 'all-monitors';
const COLUMN_NUMBER = 'column';
const KEY_GAP = 'gap';

const COLUMN = ['2', '3', '4', '5', '6', '7', '8'];

let ArrangeMenu = GObject.registerClass(
class ArrangeMenu extends PanelMenu.Button {
    _init(settings, dir) {
        super._init(0.0, _('Arrange Windows'));

        this._gsettings = settings;
        this._dir = dir;

        this._allMonitor = this._gsettings.get_boolean(ALL_MONITOR);

        let icon = new St.Icon({ gicon: this._getCustIcon('arrange-windows-symbolic'),
                                 style_class: 'system-status-icon' });
        this.add_child(icon);

        this.menu.addAction(_("Cascade"),
                            () => this.cascadeWindow(),
                            this._getCustIcon('cascade-windows-symbolic'));

        this.menu.addAction(_("Tile"),
                            () => this.tileWindow(),
                            this._getCustIcon('tile-windows-symbolic'));

        this.menu.addAction(_("Side by side"),
                            () => this.sideBySideWindow(),
                            this._getCustIcon('sidebyside-windows-symbolic'));

        this.menu.addAction(_("Stack"),
                            () => this.stackWindow(),
                            this._getCustIcon('stack-windows-symbolic'));

        this.menu.addAction(_("Master left"),
                            () => this.masterLeftWindow(),
                            this._getCustIcon('master-left-windows-symbolic'));

        this.menu.addAction(_("Master right"),
                            () => this.masterRightWindow(),
                            this._getCustIcon('master-right-windows-symbolic'));

        this.menu.addAction(_("Maximize"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.BOTH),
                            this._getCustIcon('maximize-windows-symbolic'));

        this.menu.addAction(_("Maximize Vertical"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.VERTICAL),
                            this._getCustIcon('maximize-vertical-windows-symbolic'));

        this.menu.addAction(_("Maximize Horizontal"),
                            () => this.maximizeWindow(Meta.MaximizeFlags.HORIZONTAL),
                            this._getCustIcon('maximize-horizontal-windows-symbolic'));

        this.menu.addAction(_("Restoring"),
                            () => this.restoringWindow(),
                            this._getCustIcon('restoring-window-symbolic'));

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._allMonitorItem = new PopupMenu.PopupSwitchMenuItem(_("All monitors"), this._allMonitor)
        this._allMonitorItem.connect('toggled', this._allMonitorToggle.bind(this));
        this.menu.addMenuItem(this._allMonitorItem);

        this._column = new Column(settings);
        this.menu.addMenuItem(this._column._item);

        this.gap= this._gsettings.get_int(KEY_GAP);
        this.gapID = this._gsettings.connect("changed::" + KEY_GAP, () => {
            this.gap = this._gsettings.get_int(KEY_GAP);
        });

        this.show();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    cascadeWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        let y = workArea.y + 5;
        let x = workArea.x + 10;
        let width = workArea.width * 0.7;
        let height = workArea.height * 0.7;
        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();
            win.unmaximize();
            win.move_resize_frame(false, x, y, width, height);
            x = x + CASCADE_WIDTH;
            y = y + CASCADE_HEIGHT;
        }
    }

    sideBySideWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);
        let width = Math.round(workArea.width / windows.length)

        let y = workArea.y;
        let x = workArea.x;
        for (let i = 0; i < windows.length; i++) {
            this.moveWindowToRect(windows[i], x, y, width, workArea.height);
            x = x + width;
        }
    }

    stackWindow() {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);
        let height = Math.round(workArea.height / windows.length)

        let y = workArea.y;
        let x = workArea.x;
        for (let i = 0; i < windows.length; i++) {
            this.moveWindowToRect(windows[i], x, y, workArea.width, height);
            y += height;
        }
    }

    masterLeftWindow() {
        this.masterStackWindow(false);
    }

    masterRightWindow() {
        this.masterStackWindow(true);
    }

    masterStackWindow(masterRight) {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);
        let focusedWindow = global.display.get_focus_window();
        let masterWindowIndex = windows.findIndex(actor => actor.get_meta_window() == focusedWindow);
        if (masterWindowIndex < 0)
            masterWindowIndex = 0;

        let masterWindow = windows[masterWindowIndex];
        let otherWindows = windows.filter((_, index) => index != masterWindowIndex);
        if (otherWindows.length == 0) {
            // fullscreen the only window
            this.moveWindowToRect(masterWindow, workArea.x, workArea.y, workArea.width, workArea.height);
            return;
        }

        let masterWidth = Math.round(workArea.width / 2);
        let sideWidth = workArea.width - masterWidth;
        let masterX = masterRight ? workArea.x + sideWidth : workArea.x;
        let sideX = masterRight ? workArea.x : workArea.x + masterWidth;

        this.moveWindowToRect(masterWindow, masterX, workArea.y, masterWidth, workArea.height);

        // Build side-stack rectangles first, stacked vertically
        let sideCells = [];
        let sideHeight = Math.round(workArea.height / otherWindows.length);
        let y = workArea.y;
        for (let i = 0; i < otherWindows.length; i++) {
            let height = i + 1 == otherWindows.length
                ? workArea.y + workArea.height - y
                : sideHeight;
            sideCells.push({ x: sideX, y: y, w: sideWidth, h: height });
            y += height;
        }

        // Assign other windows to side rectangles using closest-center heuristic
        let distances = [];
        for (let windowI = 0; windowI < otherWindows.length; windowI++) {
            const win = otherWindows[windowI];
            const windowCenterX = win.x + win.width / 2;
            const windowCenterY = win.y + win.height / 2;
            distances[windowI] = [];
            for (let cellJ = 0; cellJ < sideCells.length; cellJ++) {
                const cell = sideCells[cellJ];
                const dist = Math.sqrt((windowCenterX - (cell.x + cell.w / 2)) ** 2 +
                    (windowCenterY - (cell.y + cell.h / 2)) ** 2);
                distances[windowI][cellJ] = dist;
            }
        }

        const windowIsToMove = new Set(otherWindows.keys());
        const cellJsToFill = new Set(sideCells.keys());

        for (let i = 0; i < otherWindows.length; i++) {
            if (windowIsToMove.size !== cellJsToFill.size)
                throw Error('Expected to assign one cell per window');
            let minDist = Infinity;
            let minI, minJ;
            windowIsToMove.forEach(windowI =>
                cellJsToFill.forEach(cellJ => {
                        if (distances[windowI][cellJ] < minDist) {
                            minDist = distances[windowI][cellJ];
                            minI = windowI;
                            minJ = cellJ;
                        }
                    }
                )
            );
            this.moveWindowToRect(
                otherWindows[minI],
                sideCells[minJ].x,
                sideCells[minJ].y,
                sideCells[minJ].w,
                sideCells[minJ].h
            );
            windowIsToMove.delete(minI);
            cellJsToFill.delete(minJ);
        }
    }

    moveWindowToRect(actor, x, y, width, height) {
        let win = actor.get_meta_window();
        win.unmaximize();
        win.unminimize();
        win.move_resize_frame(
            false,
            x + this.gap,
            y + this.gap,
            width - (2 * this.gap),
            height - (2 * this.gap)
        );
    }

    tileWindow() {
        /* Display all windows in a grid defined by the number of columns in
         * settings.
         *
         * In the last row, the rectangles may be wider so that the remaining
         * windows equally share the total width.
         *
         * Try to assign the windows to the closest rectangle in the grid so that
         * windows move by the smallest amount. This is important because they
         * may be pressing tile from a state that is already tiled so wouldn't expect
         * the windows to change order.
         *
         * A quick heuristic to approximate this is to calculate the closest grid position
         * for each window and then assign them to the closest available in order
         * of shortest first.
         */

        let windows = this.getWindows();
        if (windows.length == 0) return;
        let workArea = this.getWorkArea(windows[0]);

        // Get number of columns from settings
        let columnNumber = parseInt(COLUMN[this._gsettings.get_int(COLUMN_NUMBER)]);
        // Calculate number of rows based on number of windows and number of columns
        let rowNumber = Math.ceil(windows.length / columnNumber);

        // Create the grid
        let gridCells = [];
        for (let i = 0; i < windows.length; i ++) {
            let row = Math.floor(i / columnNumber);
            let col = i % columnNumber;

            let gridWidth = Math.floor(workArea.width / columnNumber);
            let gridHeight = Math.floor(workArea.height / rowNumber);
            let numLastRow = windows.length % columnNumber;

            let cell = {};

            if (row + 1 === rowNumber && numLastRow !== 0) {
                // In the last row, recalculate width so that they fill the screen
                let gridWidthLastRow = Math.floor(workArea.width / numLastRow);
                cell.x = workArea.x + col * gridWidthLastRow;
                cell.w = gridWidthLastRow;
            } else {
                cell.x = workArea.x + col * gridWidth;
                cell.w = gridWidth;
            }
            cell.y = workArea.y + row * gridHeight;
            cell.h = gridHeight;
            cell.centerX = cell.x + cell.w / 2;
            cell.centerY = cell.y + cell.h / 2;
            gridCells.push(cell);
        }

        // Calculate distances[i][j] as the distance from windows[i] to
        // gridCells[j].
        let distances = [];
        for (let windowI = 0; windowI < windows.length; windowI ++) {
            const win = windows[windowI];
            const windowCenterX = win.x + win.width / 2;
            const windowCenterY = win.y + win.height / 2;
            distances[windowI] = [];
            for (let cellJ = 0; cellJ < gridCells.length; cellJ ++) {
                const cell = gridCells[cellJ];
                const dist = Math.sqrt((windowCenterX - cell.centerX) ** 2 +
                    (windowCenterY - cell.centerY) ** 2);
                distances[windowI][cellJ] = dist;
            }
        }

        // Now we can assign windows in order of closest
        const windowIsToMove = new Set(windows.keys());
        const cellJsToFill = new Set(gridCells.keys());

        // Move windows, closest to grid position first.
        for (let i = 0; i < windows.length; i ++) {
            if (windowIsToMove.size !== cellJsToFill.size)
                throw Error('Expected to assign one cell per window');
            let minDist = Infinity;
            let minI, minJ;
            windowIsToMove.forEach(windowI =>
                cellJsToFill.forEach(cellJ => {
                        if (distances[windowI][cellJ] < minDist) {
                            minDist = distances[windowI][cellJ];
                            minI = windowI;
                            minJ = cellJ;
                        }
                    }
                )
            );
            this.moveWindowToRect(
                windows[minI],
                gridCells[minJ].x,
                gridCells[minJ].y,
                gridCells[minJ].w,
                gridCells[minJ].h
            );
            windowIsToMove.delete(minI);
            cellJsToFill.delete(minJ);
        }
    }

    maximizeWindow(direction) {
        if (this._allMonitor == true) {
            this.maximizeWindowAllMonitor(direction);
            return;
        }

        let windows = this.getWindows();

        for (let i = 0; i < windows.length; i++) {
            let actor = windows[i];
            let win = actor.get_meta_window();
            win.maximize();
        }
    }

    maximizeWindowAllMonitor(direction) {
        let windows = this.getWindows();
        if (windows.length == 0)
            return;

        let workArea = this.getWorkArea(windows[0]);

        for (let i = 0; i < windows.length; i++) {
            let win = windows[i].get_meta_window();

            switch (direction) {
                case Meta.MaximizeFlags.BOTH:
                    win.move_resize_frame(true,
                                          workArea.x,
                                          workArea.y,
                                          workArea.width,
                                          workArea.height);
                    break;
                case Meta.MaximizeFlags.VERTICAL:
                    win.move_resize_frame(true,
                                          win.get_frame_rect().x,
                                          workArea.y,
                                          win.get_frame_rect().width,
                                          workArea.height);
                    break;
                case Meta.MaximizeFlags.HORIZONTAL:
                    win.move_resize_frame(true,
                                          workArea.x,
                                          win.get_frame_rect().y,
                                          workArea.width,
                                          win.get_frame_rect().height);
                    break;
            }
        }
    }

    restoringWindow() {
        let windows = this.getWindows();

        for (let i = 0; i < windows.length; i++) {
            let actor = windows[i];
            let win = actor.get_meta_window();
            win.unmaximize();
        }
    }

    getWindows() {
        let currentWorkspace = global.workspace_manager.get_active_workspace();

        let windows = global.get_window_actors().filter(actor => {
            if (actor.meta_window.get_window_type() == Meta.WindowType.NORMAL)
                return actor.meta_window.located_on_workspace(currentWorkspace);

            return false;
        });

        if (!(this._allMonitor)) {
            windows = windows.filter(w => {
                return w.meta_window.get_monitor() == this.getFocusedMonitor();
            });
        }
        return windows;
    }

    getFocusedMonitor() {
        let focusWindow = global.display.get_focus_window();
        if (focusWindow) {
            return focusWindow.get_monitor();
        } else {
            return global.display.get_current_monitor();
        }
    }

    getWorkArea(window) {
        if (this._allMonitor)
            return window.get_meta_window().get_work_area_all_monitors();
        else
            return window.get_meta_window().get_work_area_current_monitor();
    }

    _allMonitorToggle() {
        this._allMonitor = this._allMonitorItem.state;
        this._gsettings.set_boolean(ALL_MONITOR, this._allMonitorItem.state);
    }

    _getCustIcon(icon_name) {
        let gicon = Gio.icon_new_for_string( this._dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
        return gicon;
    }

    _onDestroy(){
        if (this.gapID)
            this._gsettings.disconnect(this.gapID);
            this.gapID = 0;
    }
});

const Column = GObject.registerClass(
class Column extends SystemIndicator {
    _init(settings) {
        super._init();

        this._gsettings = settings;

        this._item = new PopupMenu.PopupBaseMenuItem({ activate: false });
        this.quickSettingsItems.push(this._item);

        this._slider = new Slider.Slider(0);
        this._slider.connect('drag-end', this._sliderChanged.bind(this));

        let number = this._gsettings.get_int(COLUMN_NUMBER);
        this._slider.value = number / 6;
        this._label = new St.Label({ text: 'Tile x' + COLUMN[number] });

        this._item.add_child(this._label);
        this._item.add_child(this._slider);
    }

    _sliderChanged() {
        let number = Math.round(this._slider.value * 6);
        this._slider.value = number / 6;
        this._label.set_text('Tile x' + COLUMN[number]);
        this._gsettings.set_int(COLUMN_NUMBER, number);
    }
});

export default ArrangeMenu;
