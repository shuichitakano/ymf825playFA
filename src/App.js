import 'typeface-roboto'
import React from 'react';
import PropTypes from 'prop-types';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core/styles';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';

import { Grid, Paper, Button, AppBar, Toolbar, TextField, List, ListItem, ListItemText, ListItemIcon, Divider, Avatar, IconButton } from '@material-ui/core';
import Collapse from '@material-ui/core/Collapse';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import Drawer from '@material-ui/core/Drawer';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText'; import Dialog from '@material-ui/core/Dialog';
import { Switch, FormControlLabel } from '@material-ui/core';
import { PlayArrow, SkipPrevious, SkipNext, Stop, Folder, Menu as MenuIcon } from '@material-ui/icons';
import MusicNoteIcon from '@material-ui/icons/MusicNote';
import QueueMusicIcon from '@material-ui/icons/QueueMusic';
import PlaylistAddIcon from '@material-ui/icons/PlaylistAdd';
import SdCardIcon from '@material-ui/icons/SdCard';
import CloudIcon from '@material-ui/icons/Cloud';
import SettingsIcon from '@material-ui/icons/Settings';
import FolderOpenIcon from '@material-ui/icons/FolderOpen';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Checkbox from '@material-ui/core/Checkbox';
import Hidden from '@material-ui/core/Hidden';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';


var playerDir = "/lua";
//var flashAirURLBase = "http://flashair";
//var appURLBase = flashAirURLBase + playerDir;
var flashAirURLBase = "";
var appURLBase = playerDir;
//var testMode = true;
var testMode = false;


const drawerWidth = 240;

const styles = theme => ({
    root: {
        flexGrow: 1,
        //        zIndex: 1,
        position: 'relative',
        display: 'flex',
        width: '100%',
        overflow: 'hidden'
    },
    appBar: {
        position: 'absolute',
        marginLeft: drawerWidth,
        // [theme.breakpoints.up('md')]: {
        //     width: `calc(100% - ${drawerWidth}px)`,
        // },
        zIndex: theme.zIndex.drawer + 1,
    },
    navIconHide: {
        [theme.breakpoints.up('md')]: {
            display: 'none',
        },
    },
    flex: {
        flex: 1,
    },
    menuButton: {
        marginLeft: -12,
        marginRight: 20,
    },
    toolbar: theme.mixins.toolbar,
    drawerPaper: {
        width: drawerWidth,
        [theme.breakpoints.up('md')]: {
            position: 'relative',
        },
    },
    content: {
        flexGrow: 1,
        backgroundColor: theme.palette.background.default,
        padding: theme.spacing.unit * 3,
        overflow: 'hidden'
    },
});





const ListMode = {
    FlashAir: 0,
    Cloud: 1,
    Playlist: 2,
};

let canceled = false;

function getFileNameBody(fname) {
    return fname.match(/^(.+)(\..+)$/)[1];
}

async function sendCommand(cmd) {
    try {
        const url
            = flashAirURLBase + "/command.cgi?op=131&ADDR=0&LEN="
            + cmd.length + "&DATA=" + cmd;
        console.log("cmd url: " + url);

        if (!testMode) {
            const response = await fetch(url, { method: "GET" });
            return response.status === 200;
        }
        return true;
    }
    catch (e) {
        console.log("error: " + e);
        return false;
    }
}

async function setTime() {
    try {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const date = d.getDate();
        const hours = d.getHours();
        const minutes = d.getMinutes();
        const seconds = d.getSeconds();
        console.log(year + "/" + month + "/" + date + " " + hours + ":" + minutes + ":" + seconds);

        const t = (
            (seconds / 2) |
            (minutes << 5) |
            (hours << 11) |
            (date << 16) |
            (month << 21) |
            ((year - 1980) << 25));

        const url
            = flashAirURLBase + "/upload.cgi?FTIME=0x" + t.toString(16);
        console.log("cmd url: " + url);

        if (!testMode) {
            const response = await fetch(url, { method: "GET" });
            return response.status === 200;
        }
        return true;
    }
    catch (e) {
        console.log("error: " + e);
        return false;
    }
}

function asyncTest(str, time) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log("here:" + str);
            resolve(str);
        }, time);
    });
}


function toHex(v, n) {
    const s = v.toString(16);
    const l = s.length;
    if (l > n)
        return s.substr(l - n, n);
    else if (l < n)
        return "0".repeat(n - l) + s;
    return s;
}

class SimpleJobQueue {
    constructor() {
        this.queue = [];
        this.active = false;
    }

    add(j) {
        this.queue.push(j);
        this.kick();
        return j;
    }

    async kick() {
        if (this.queue.length) {
            canceled = true;
            await sendCommand("!");	// 曲を止める
        }

        if (this.active) {
            return;
        }

        this.active = true;

        while (this.queue.length) {
            let j = this.queue[0];
            this.queue.shift();

            await j();

            await asyncTest("wait..", 100)
        }
        this.active = false;
    }
};

var jobQueue = new SimpleJobQueue();


class FileEntry extends React.Component {
    constructor(props) {
        super(props);
        this.state = { title: "--" };
    }

    getPath() {
        if (this.props.listMode === ListMode.Playlist)
            return this.props.name;
        return this.props.dir + "/" + this.props.name;
    }

    componentDidMount() {
        let fname = this.getPath();
        let url = appURLBase + "/get_title.lua?" + fname;
        console.log("uri:" + url);
        if (testMode)
            url = "test_title.htm";

        jobQueue.add(
            async () => {
                try {
                    let response = await fetch(url, { method: "get" });
                    if (response.status !== 200)
                        throw new Error("load title error");

                    let text = (await response.text()).trim();
                    if (text.charAt(0) === '"' && text.charAt(text.length - 1) === '"') {
                        text = text.substr(1, text.length - 2);
                    }
                    this.setState({ title: text });
                } catch (e) {
                    console.log("error: " + e);
                }
            });
    }

    handleClick(event) {
        this.props.onSelect(this.props.name, this.props.hasbin, this.props.idx);
    }

    handleAddPlaylistMenu = (e) => {
        this.props.onAddPlaylistMenu(this.props.name, e.currentTarget);
    };

    render() {
        var _2ndAct;
        if (this.props.listMode !== ListMode.Playlist) {
            _2ndAct = (
                <ListItemSecondaryAction>
                    <IconButton onClick={this.handleAddPlaylistMenu}>
                        <PlaylistAddIcon />
                    </IconButton>
                </ListItemSecondaryAction>
            );
        }

        return (
            <div>
                <ListItem button
                    onClick={this.handleClick.bind(this)}
                // selected={this.props.playing}
                >
                    {this.props.playing && (<ListItemIcon><PlayArrow /></ListItemIcon>)}
                    <ListItemText
                        primary={this.state.title}
                        secondary={this.props.info} />
                    {_2ndAct}
                </ListItem>
                <Divider />
            </div>);
    }
};

class DirEntry extends React.Component {
    handleClick(event) {
        this.props.onSelect(this.props.name);
    }

    render() {
        return (
            <div>
                <ListItem button onClick={this.handleClick.bind(this)} >
                    <Avatar> <Folder /> </Avatar>
                    <ListItemText primary={this.props.name} />
                </ListItem>
                <Divider inset />
            </div>);
    }
};


class FileList extends React.Component {
    render() {
        //        const needDir = this.props.listMode != ListMode.Playlist;
        const needDir = this.props.listMode === ListMode.FlashAir;

        const dir = this.props.dir;
        const nodes = this.props.files.map((d, idx) => {
            var info;
            switch (this.props.listMode) {
                case ListMode.FlashAir:
                case ListMode.Cloud:
                    info = d.name + " : " + d.size + "bytes";
                    if (this.props.hasbin)
                        info += " (bin)";
                    break;

                default:
                    info = d.name;
                    break;
            };
            return (<FileEntry
                dir={dir} name={d.name} info={info}
                key={dir + "/" + d.name} idx={idx} playing={idx === this.props.playIdx}
                onSelect={this.props.onSelectFile}
                listMode={this.props.listMode}
                onAddPlaylistMenu={this.props.onAddPlaylistMenu} />);
        });
        const dirNodes = this.props.dirs.map((d) => {
            return (<DirEntry name={d.name} onSelect={this.props.onSelectDir}
                key={d.name} />);
        });
        let parentDir;
        if (dir !== "/" && needDir)
            parentDir = (<DirEntry name=".." onSelect={this.props.onSelectDir} />);

        let icon;
        switch (this.props.listMode) {
            case ListMode.FlashAir:
                //                icon = (<FolderOpenIcon />);
                icon = (<SdCardIcon />);
                break;

            case ListMode.Cloud:
                icon = (<CloudIcon />);
                break;

            case ListMode.Playlist:
                icon = (<QueueMusicIcon />);
                break;

            default:
                break;
        }

        let title;
        if (needDir) {
            title = this.props.dir;
        } else {
            title = this.props.currentPlaylist;
        }

        return (
            <Grid container style={{ paddingTop: 2, paddingBotton: 2, marginTop: 10 }}>
                <Grid item xs={12}>
                    <Typography variant="display1" paragraph> {icon} {title} </Typography>
                </Grid>
                <Grid item xs={12}>
                    <List>
                        {parentDir} {dirNodes} {nodes}
                    </List>
                </Grid>
            </Grid>);
    }
};

const fixedWidthFontTheme = createMuiTheme({
    typography: {
        fontFamily: [
            '"Courier New"',
            'Consolas',
            'monospace',
        ].join(','),
    },
});

class EditPanel extends React.Component {
    handleChangeText(e) {
        this.props.onChangeText(e.target.value);
    }

    handleChangeEditMode(e) {
        this.props.onChangeEditMode();
    }

    handleChangeFile(e) {
        this.props.onChangeFile(e.target.value);
    }

    handleClickSave(e) {
        this.props.onSaveText();
    }

    render() {
        let panel;
        if (this.props.editMode) {
            panel = (
                <Grid item xs={12}>
                    <Paper>
                        <Grid container justify="center" spacing={24}>
                            <Grid item xs={10}>
                                <TextField label="Filename" onChange={this.handleChangeFile.bind(this)} value={this.props.file} />
                            </Grid>
                            <Grid item xs={2}>
                                <Grid container justify="flex-end">
                                    <Grid item>
                                        <Button onClick={this.handleClickSave.bind(this)}> Save </Button>
                                        <Button onClick={this.props.onNewFile}> New </Button>
                                    </Grid>
                                </Grid>
                            </Grid>
                            <Grid item xs={12} >
                                <MuiThemeProvider theme={fixedWidthFontTheme}>
                                    <TextField label="MML Editor"
                                        multiline fullWidth
                                        autoComplete="nope" noValidate spellCheck="false"
                                        style={{ fontFamily: "Courier New" }}
                                        value={this.props.text}
                                        onChange={this.handleChangeText.bind(this)} />
                                </MuiThemeProvider>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>);
        }

        return (<Grid container justify="center">
            <Grid container justify="flex-end">

                <FormControlLabel control={
                    <Switch checked={this.props.editMode} onChange={this.handleChangeEditMode.bind(this)} />}
                    label="Edit Mode" />
            </Grid>
            {panel}
        </Grid>);
    }
};

class PlayerControl extends React.Component {

    onVolumeChange(e) {
        this.props.onVolume(e);
    }


    render() {
        return (
            <Grid container justify="center" spacing={32}>
                <Grid item>
                    <Button variant="fab" color="default" onClick={this.props.onPrev} > <SkipPrevious /> </Button>
                </Grid>
                <Grid item>
                    <Button variant="fab" color="primary" onClick={this.props.onPlay} > <PlayArrow /> </Button>
                </Grid>
                <Grid item>
                    <Button variant="fab" color="default" onClick={this.props.onStop} > <Stop /> </Button>
                </Grid>
                <Grid item>
                    <Button variant="fab" color="default" onClick={this.props.onNext} > <SkipNext /> </Button>
                </Grid>
                <Grid item xs={12}>
                    <Slider min={0} max={63} defaultValue={this.props.volume} onAfterChange={this.onVolumeChange.bind(this)} />
                </Grid>
            </Grid>
        );
    }
};

class FormDialog extends React.Component {
    handleClose = (e) => {
        e.preventDefault();
        const text = this.input.value.trim();
        this.props.onClose(text);
    };

    handleCancel = () => {
        this.props.onClose();
    };

    render() {
        const { classes, onClose, selectedValue, ...other } = this.props;

        return (
            <Dialog
                onClose={this.handleClose}
                aria-labelledby="form-dialog-title"
                {...other}
            >
                <form onSubmit={this.handleClose}>
                    <DialogTitle id="form-dialog-title">{this.props.title}</DialogTitle>
                    <DialogContent>
                        <DialogContentText> {this.props.text} </DialogContentText>
                        <TextField
                            autoFocus
                            margin="dense"
                            inputRef={(input) => this.input = input}
                            id="name"
                            label={this.props.label}
                            type="text"
                            fullWidth
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleCancel} color="primary"> Cancel </Button>
                        <Button onClick={this.handleClose} color="primary"> OK </Button>
                    </DialogActions>
                </form>
            </Dialog>
        );
    }
};

function makePathString(dir, file) {
    if (dir !== "/")
        return dir + "/" + file;
    return file;
}

async function saveText(dir, file, text) {
    let url = flashAirURLBase + makePathString(dir, file);
    console.log("save file url: " + url);
    if (!testMode) {
        const response = await fetch(url, {
            method: "PUT",
            body: text,
            headers: {
                "Content-Type": "text/plain"
            }
        });
        return response.status === 200;
    }
    return true;
}

async function loadPlaylist(playlistFile) {
    try {
        let url = flashAirURLBase + "/playlists/" + playlistFile;
        console.log("load playlist url: " + url);
        if (testMode)
            url = "test_playlist.htm";

        const response = await fetch(url, { method: "get" });
        if (response.status !== 200)
            throw new Error("load playlist error");

        const text = await response.text();
        //        console.log("text=" + text);

        return text.split(/\n/g);
    }
    catch (e) {
        console.log("error: " + e);
        return null;
    }
}

async function savePlaylist(playlistFile, list) {
    const text = list.join("\n");
    //    console.log("text=" + text);
    await saveText("/playlists", playlistFile, text);
}

async function addToPlaylist(playlistFile, file) {
    const list = await loadPlaylist(playlistFile);
    if (!list)
        return;
    list.push(file);
    await savePlaylist(playlistFile, list);
}



//class App extends React.Component {
class App extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            fileList: [],
            dirList: [],
            playlistList: [],
            currentDir: "/",
            text: "",
            editMode: false,
            currentFile: "",
            currentPlayIdx: 0,
            volume: 32,
            chMask: 65535,
            alwaysConvert: false,
            settingsMenuAnchorEl: null,
            drawerOpen: false,
            playlistOpen: false,
            playlistNewDialogOpen: false,
            addPlaylistMenuAnchor: null,
            playlistToAddFile: null,
            listMode: ListMode.FlashAir,
            currentPlaylist: null,
        };
    }

    async updateFileList(dir) {
        try {
            let url = flashAirURLBase + "/command.cgi?op=100&DIR=" + dir;
            console.log("url:" + url);
            if (testMode)
                url = "test_filelist.htm";
            const response = await fetch(url, { method: "get" });
            if (response.status !== 200)
                throw new Error("load title error");
            const text = await response.text();
            let lines = text.split(/\n/g);
            lines.shift();		// WLANSD_FILELIST
            lines.pop();		// empty
            let fileList = [];
            let binList = [];
            let dirList = [];
            for (let i = 0; i < lines.length; ++i) {
                const elements = lines[i].split(",");
                const fname = elements[1];
                const date = Number(elements[4]);
                const time = Number(elements[5]);
                const attr = Number(elements[3]);
                const isDir = attr & 16;
                const tv = (date << 16) | time;

                if (isDir) {
                    dirList.push({
                        name: fname,
                        date: tv
                    });
                }
                else {
                    const spf = fname.split(".");
                    const ext = spf[spf.length - 1].toLowerCase();

                    if (ext === "mus") {
                        fileList.push({
                            name: fname,
                            size: Number(elements[2]),
                            date: tv,
                            hasbin: false,
                        });
                    }
                    else if (ext === "mbin") {
                        const body = getFileNameBody(fname);
                        binList[body] = tv;
                    }
                }
            }
            for (let i = 0; i < fileList.length; ++i) {
                const e = fileList[i];
                const body = getFileNameBody(e.name);
                const be = binList[body];
                if (be && e.date < be) {
                    console.log("bin found." + e.name + ":" + e.date + ":" + be);
                    e["hasbin"] = true;
                }
            }
            fileList.sort(function (a, b) {
                let sa = a["name"].toLowerCase();
                let sb = b["name"].toLowerCase();
                return sa === sb ? 0 : (sa < sb ? -1 : 1);
            });

            this.setState({
                currentPlayIdx: -1,
                fileList: fileList,
                dirList: dirList
            });
        }
        catch (e) {
            console.log("error: " + e);
        }
    }

    async updatePlaylistList() {
        try {
            let url = flashAirURLBase + "/command.cgi?op=100&DIR=" + flashAirURLBase + "/playlists";
            console.log("url:" + url);
            if (testMode)
                url = "test_playlists.htm";
            const response = await fetch(url, { method: "get" });
            if (response.status !== 200)
                throw new Error("load playlist error");
            const text = await response.text();
            let lines = text.split(/\n/g);
            lines.shift();		// WLANSD_FILELIST
            lines.pop();		// empty
            let fileList = [];
            for (let i = 0; i < lines.length; ++i) {
                const elements = lines[i].split(",");
                const fname = elements[1];
                const attr = Number(elements[3]);
                const isDir = attr & 16;
                if (!isDir) {
                    const spf = fname.split(".");
                    const ext = spf[spf.length - 1].toLowerCase();

                    if (ext === "playlist") {
                        fileList.push(getFileNameBody(fname));
                    }
                }
            }
            fileList.sort();
            this.setState({ playlistList: fileList });
        }
        catch (e) {
            console.log("error: " + e);
        }
    }


    setText(text) {
        this.setState({ text: text });
    }

    async loadText(dir, file) {
        if (file === "")
            return;

        try {
            const path = dir + "/" + file;
            //            let url = appURLBase + "/read.lua?" + path;
            let url = flashAirURLBase + path;
            console.log("load text url: " + url);
            if (testMode)
                url = "test_text.htm";
            const response = await fetch(url, { method: "get" });
            if (response.status !== 200)
                throw new Error("load file error");

            const text = await response.text();
            this.setText(text);
        }
        catch (e) {
            console.log("error: " + e);
        }
    }

    async setCurrentDirAndTime(dir) {
        let url = flashAirURLBase + "/upload.cgi?UPDIR=" + dir + "&TIME=" + (Date.now());
        console.log("setDir: " + url);
        if (!testMode) {
            return await fetch(url, { method: "get" });
        }
    }

    async updateCommand(vol, mask) {
        const str = "S" + toHex(vol, 2) + ":" + toHex(mask, 4);
        await sendCommand(str);
    }

    async _playMMLFile(dir, file, idx) {
        if (file === "")
            return false;

        try {
            const path = dir + "/" + file;
            let url = appURLBase + "/player.lua?" + path + "%20" + this.state.volume + "%20" + idx;
            console.log("play url: " + url);
            if (!testMode) {
                const response = await fetch(url, { method: "get" });
                if (response.status !== 200)
                    throw new Error("play file error");

                const text = await response.text();
                console.log("log = " + text);	// todo: どこかに表示しないと
            }
        }
        catch (e) {
            console.log("error: " + e);
        }
    }

    async _convert(dir, file) {
        if (file === "")
            return false;

        try {
            const path = dir + "/" + file;
            let url = appURLBase + "/converter.lua?" + path;
            console.log("convert url: " + url);
            if (!testMode) {
                const response = await fetch(url, { method: "get" });
                if (response.status !== 200)
                    throw new Error("convert file error");

                const text = await response.text();
                console.log("log = " + text);	// todo: どこかに表示しないと
            }
        }
        catch (e) {
            console.log("error: " + e);
        }
    }

    async _playBinFile(dir, file) {
        if (file === "")
            return false;

        try {
            const body = file.match(/^(.+)(\..+)$/)[1];
            console.log("body:" + body);

            const path = dir + "/" + body + ".mbin";
            const url = appURLBase + "/bin_player.lua?" + path + "%20" + this.state.volume;
            console.log("play bin url: " + url);
            if (!testMode) {
                const response = await fetch(url, { method: "get" });
                if (response.status !== 200)
                    throw new Error("play bin file error");

                const text = await response.text();
                console.log("log = " + text);	// todo: どこかに表示しないと
            }
        }
        catch (e) {
            console.log("error: " + e);
        }
    }

    playFile(dir, file, hasbin, idx) {
        if (file === "")
            return;

        if (this.state.currentPlaylist) {
            file = this.state.currentPlaylist + ".playlist";
            dir = "/playlists";
        }
        jobQueue.add(async () => { await this._playMMLFile(dir, file, idx) });
        // jobQueue.add(async () => {
        //     canceled = false;
        //     if (this.state.alwaysConvert || !hasbin) {
        //         await setTime();
        //         await this._convert(dir, file);
        //         await asyncTest("convert wait", 100);
        //     }
        //     await this._playBinFile(dir, file);
        //     if (testMode)
        //         await asyncTest("playing...", 1000);
        //     if (!canceled && idx >= 0)
        //         this.playFileByIdx(++idx);
        // });
    }

    playFileByIdx(idx) {
        const n = this.state.fileList.length;
        if (idx >= n || idx < 0) {
            this.setState({ currentPlayIdx: -1 });
            return;
        }
        console.log("file idx:" + idx + "/" + n);

        const dir = this.state.currentDir;
        const f = this.state.fileList[idx];
        const file = f["name"];
        const hasbin = f["hasbin"];

        this.playFile(dir, file, hasbin, idx);
        this.setState({ currentPlayIdx: idx });
    }



    onNewFile() {
        this.setState({ currentFile: "" });
        this.setText("");
    }

    onSelectFile(file, hasbin, idx) {
        const dir = this.state.listMode === ListMode.Playlist ? "" : this.state.currentDir;
        this.setState({ currentFile: file });
        if (this.state.editMode) {
            this.loadText(dir, file);
        }
        else {
            this.playFile(dir, file, hasbin, idx);
            this.setState({ currentPlayIdx: idx });
        }
    }

    onSelectDir(dir) {
        let path = this.state.currentDir;
        if (dir === "..") {
            const pos = path.lastIndexOf("/");
            if (pos === 0)
                path = "/";
            else
                path = path.substr(0, pos);
        }
        else {
            if (path.charAt(path.length - 1) !== "/")
                path = path + "/";
            path += dir;
        }
        console.log("path:" + path);
        this.setState({ currentDir: path });
        this.updateFileList(path);
    }

    onChangeEditMode() {
        // todo: 保存するか聞く
        const mode = !this.state.editMode ? true : false;
        this.setState({ editMode: mode });
        if (mode)
            this.loadText(this.state.currentDir, this.state.currentFile);
    }

    onChangeCurrentFile(file) {
        this.setState({ currentFile: file });
    }

    onChangeCurrentDir(dir) {
        this.setState({ currentDir: dir });
    }

    async onSaveText() {
        let file = this.state.currentFile;
        if (file === "") {
            if (this.state.text === "")
                return;

            file = "no_name";
        }
        const extpos = file.lastIndexOf(".");
        if (extpos < 0 ||
            file.substr(extpos).toLowerCase() !== ".mus") {
            file += ".mus";
            this.setState({ currentFile: file });
        }
        await saveText(this.state.currentDir, file, this.state.text);
        this.updateFileList(this.state.currentDir);
    }

    onPlay() {
        console.log("play");
        if (this.state.editMode && this.state.text !== "") {
            (async () => {
                let r = await saveText(playerDir, "_tmp.mus", this.state.text);
                if (r)
                    this.playFile(playerDir, "_tmp.mus", false, -1);
            })();
        }
    }

    onStop() {
        canceled = true;
        sendCommand("!");
        this.setState({ currentPlayIdx: -1 });
    }

    onPrev() {
        if (this.state.editMode)
            return;

        canceled = true;
        sendCommand("!");
        jobQueue.add(async () => {
            this.playFileByIdx(this.state.currentPlayIdx - 1);
        });
    }

    onNext() {
        if (this.state.editMode)
            return;

        canceled = true;
        sendCommand("!");
        jobQueue.add(async () => {
            this.playFileByIdx(this.state.currentPlayIdx + 1);
        });
    }

    onVolume(v) {
        console.log("vol = " + v);
        this.setState({ volume: v });
        this.updateCommand(v, this.state.chMask);
    }

    componentDidMount() {
        this.updateFileList(this.state.currentDir);
        this.updatePlaylistList();
    }

    handleSettingsMenu = event => {
        this.setState({ settingsMenuAnchorEl: event.currentTarget });
    };
    handleRequestSettingsMenuClose = () => {
        this.setState({ settingsMenuAnchorEl: null });
    };

    handleCheckChange = name => event => {
        this.setState({ [name]: event.target.checked });
    };

    handlePlaylistClick = () => {
        this.setState({ playlistOpen: !this.state.playlistOpen });
    };

    handleDrawerToggle = () => {
        this.setState({ drawerOpen: !this.state.drawerOpen });
    };

    handlePlaylistNewOpen = () => {
        this.setState({ playlistNewDialogOpen: true });
    };

    handleAddPlaylistMenu = (fname, target) => {
        console.log("add playlist:" + fname);
        this.setState({
            playlistToAddFile: fname,
            addPlaylistMenuAnchor: target
        });
    };

    handleCloseAddPlaylistMenu = (i) => {
        if (this.state.playlistToAddFile) {
            console.log("close " + i + ", file" + this.state.playlistToAddFile);
            addToPlaylist(
                this.state.playlistList[i] + ".playlist",
                makePathString(
                    this.state.currentDir,
                    this.state.playlistToAddFile));
        }
        this.setState({
            playlistToAddFile: null,
            addPlaylistMenuAnchor: null
        });
    };

    handlePlaylistNewDialogClose = async value => {
        if (value) {
            console.log("new playlist:" + value);
            if (this.state.playlistList.indexOf(value) < 0) {
                await saveText("/playlists", value + ".playlist", "");
                this.updatePlaylistList();
            } else {
                console.log("already exist.");
            }
        }
        this.setState({ playlistNewDialogOpen: false });
    };

    changeListMode = mode => {
        if (this.state.listMode === mode)
            return;

        this.setState({
            listMode: mode,
            currentPlaylist: null,
            drawerOpen: false,
        });

        if (mode === ListMode.FlashAir) {
            this.updateFileList(this.state.currentDir);
        } else {
            this.setState({ fileList: [], dirList: [] });
        }
    };

    setCurrentPlaylist = async playlist => {
        if (this.state.currentPlaylist === playlist)
            return;

        const list = await loadPlaylist(playlist + ".playlist");
        let flist = [];
        for (const l of list) {
            if (l !== "") {
                console.log("l=" + l);
                flist.push({ name: l });
            }
        }
        // const flist = list.map((l) => {
        //     return {
        //         name: l
        //     };
        // });

        this.setState({
            currentPlaylist: playlist,
            listMode: ListMode.Playlist,
            fileList: flist,
            dirList: [],
            drawerOpen: false,
        });
    };

    static propTypes = {
        classes: PropTypes.object.isRequired,
    };

    render() {
        const { classes, theme } = this.props;

        const openSettingsMenu = Boolean(this.state.settingsMenuAnchorEl);
        const openDrawer = this.state.drawerOpen;

        const playlists = this.state.playlistList.map((l) => {
            return (
                <MenuItem button key={l}
                    selected={this.state.currentPlaylist === l}
                    onClick={() => { this.setCurrentPlaylist(l) }}
                >
                    <ListItemText> {l} </ListItemText>
                </MenuItem>
            );
        });

        const addPlaylists = this.state.playlistList.map((l, idx) => {
            return (
                <MenuItem key={l}
                    onClick={() => { this.handleCloseAddPlaylistMenu(idx); }}> {l}
                </MenuItem>
            );
        });

        const drawer = (
            <div>
                <div className={classes.toolbar} />
                <Divider />
                <List>
                    <MenuItem button
                        aria-owns={openSettingsMenu ? 'menu-settings' : null}
                        aria-haspopup="true"
                        onClick={this.handleSettingsMenu}>
                        <ListItemIcon>
                            <SettingsIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Settings"
                        />
                    </MenuItem>
                    <Divider />
                    <MenuItem button
                        selected={this.state.listMode === ListMode.FlashAir}
                        onClick={() => { this.changeListMode(ListMode.FlashAir); }}
                    >
                        <ListItemIcon>
                            <SdCardIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="FlashAir"
                        />
                    </MenuItem>
                    <MenuItem button
                        selected={this.state.listMode === ListMode.Cloud}
                        onClick={() => { this.changeListMode(ListMode.Cloud); }}
                    >
                        <ListItemIcon>
                            <CloudIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Cloud?"
                        />
                    </MenuItem>
                    <MenuItem button
                        selected={this.state.listMode === ListMode.Playlist}
                        onClick={this.handlePlaylistClick}
                    >
                        <ListItemIcon>
                            <QueueMusicIcon />
                        </ListItemIcon>
                        <ListItemText
                            primary="Playlists"
                        />
                        {this.state.playlistOpen ? <ExpandLess /> : <ExpandMore />}
                    </MenuItem>
                    <Collapse in={this.state.playlistOpen} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                            {playlists}
                            <MenuItem button onClick={this.handlePlaylistNewOpen} >
                                <ListItemText primary="New Playlist" primaryTypographyProps={{ variant: 'button' }} />
                            </MenuItem>
                        </List>
                    </Collapse>
                </List>
            </div>
        );

        return (
            <div className={classes.root}>
                <AppBar className={classes.appBar} color="default">
                    <Toolbar>
                        <div>
                            <IconButton aria-label="Menu"
                                onClick={this.handleDrawerToggle}
                                className={classes.navIconHide}
                            >
                                <MenuIcon />
                            </IconButton>
                        </div>
                        <Typography variant="title" color="inherit" className={classes.flex}>
                            YMF825Player
	  	                </Typography>
                    </Toolbar>
                </AppBar>
                <Hidden mdUp>
                    <Drawer
                        variant="temporary"
                        anchor="left"
                        open={openDrawer}
                        onClose={this.handleDrawerToggle}
                        ModalProps={{
                            keepMounted: true,
                        }}
                        classes={{
                            paper: classes.drawerPaper,
                        }}
                    >
                        {drawer}
                    </Drawer>
                </Hidden>
                <Hidden smDown implementation="css">
                    <Drawer
                        variant="permanent"
                        open
                        classes={{
                            paper: classes.drawerPaper,
                        }}
                    >
                        {drawer}
                    </Drawer>
                </Hidden>

                <Menu
                    id="menu-settings"
                    anchorEl={this.state.settingsMenuAnchorEl}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                    }}
                    transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                    }}
                    open={openSettingsMenu}
                    onClose={this.handleRequestSettingsMenuClose}
                >
                    <MenuItem>
                        <Checkbox checked={this.state.alwaysConvert}
                            onChange={this.handleCheckChange('alwaysConvert')}
                        />
                        <Typography className={classes.typography}> Convert always</Typography>
                    </MenuItem>
                </Menu>
                <FormDialog
                    open={this.state.playlistNewDialogOpen}
                    onClose={this.handlePlaylistNewDialogClose}
                    title="New Playlist"
                    text="Please enter a name for the new playlist."
                    label="Name"
                />
                <Menu
                    id="add-playlist-menu"
                    anchorEl={this.state.addPlaylistMenuAnchor}
                    open={Boolean(this.state.addPlaylistMenuAnchor)}
                    onClose={this.handleCloseAddPlaylistMenu}
                >
                    {addPlaylists}
                </Menu>


                <main className={classes.content}>
                    <div className={classes.toolbar} />

                    <PlayerControl
                        onPlay={this.onPlay.bind(this)}
                        onStop={this.onStop.bind(this)}
                        onPrev={this.onPrev.bind(this)}
                        onNext={this.onNext.bind(this)}
                        onVolume={this.onVolume.bind(this)}
                        volume={this.state.volume}
                    />
                    <EditPanel
                        text={this.state.text} onChangeText={this.setText.bind(this)}
                        editMode={this.state.editMode} onChangeEditMode={this.onChangeEditMode.bind(this)}
                        file={this.state.currentFile} onChangeFile={this.onChangeCurrentFile.bind(this)}
                        onNewFile={this.onNewFile.bind(this)}
                        onSaveText={this.onSaveText.bind(this)}
                    />
                    <FileList
                        files={this.state.fileList} dirs={this.state.dirList}
                        dir={this.state.currentDir}
                        playIdx={this.state.currentPlayIdx}
                        onSelectFile={this.onSelectFile.bind(this)}
                        onSelectDir={this.onSelectDir.bind(this)}
                        onAddPlaylistMenu={this.handleAddPlaylistMenu}
                        listMode={this.state.listMode}
                        currentPlaylist={this.state.currentPlaylist}
                    />

                </main>
            </div >);
    };
};

App.propTypes = {
    classes: PropTypes.object.isRequired,
    theme: PropTypes.object.isRequired,
};

export default withStyles(styles, { withTheme: true })(App);
