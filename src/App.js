import 'typeface-roboto'
import React from 'react';
import PropTypes from 'prop-types';
import Typography from '@material-ui/core/Typography';
import { withStyles } from '@material-ui/core/styles';
import { MuiThemeProvider, createMuiTheme } from '@material-ui/core/styles';

import { Card, Grid, Paper, Button, AppBar, Toolbar, TextField, List, ListItem, ListItemText, ListItemIcon, Divider, Avatar, IconButton } from '@material-ui/core';
//import Collapse from 'material-ui/transitions/Collapse';
import { Switch, FormControlLabel } from '@material-ui/core';
import { PlayArrow, SkipPrevious, SkipNext, Stop, Folder, MusicNote, Menu as MenuIcon } from '@material-ui/icons';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Checkbox from '@material-ui/core/Checkbox';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

const styles = {
    root: {
        width: '100%',
    },
    flex: {
        flex: 1,
    },
    menuButton: {
        marginLeft: -12,
        marginRight: 20,
    },
};


var playerDir = "/lua";
//var flashAirURLBase = "http://flashair";
//var appURLBase = flashAirURLBase + playerDir;
var flashAirURLBase = "";
var appURLBase = playerDir;
//var testMode = true;
var testMode = false;

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
        return this.props.dir + "/" + this.props.name;
    }

    componentDidMount() {
        let fname = this.getPath();
        let url = appURLBase + "/get_title.lua?" + fname;
        if (testMode)
            url = "test_title.htm";
        //        console.log("uri:" + url);

        jobQueue.add(
            async () => {
                try {
                    let response = await fetch(url, { method: "get" });
                    if (response.status !== 200)
                        throw ("load title error");

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

    render() {
        //                <Avatar> <MusicNote /> </Avatar>
        return (
            <div>
                <ListItem button onClick={this.handleClick.bind(this)}>
                    {this.props.playing && (<ListItemIcon><PlayArrow /></ListItemIcon>)}
                    <ListItemText inset primary={this.state.title} secondary={this.props.name + " : " + this.props.size + "bytes" + (this.props.hasbin ? " : (bin)" : "")} />
                </ListItem>
                <Divider inset />
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
        let idx = 0;
        const dir = this.props.dir;
        const nodes = this.props.files.map((d) => {
            return (<FileEntry
                dir={dir} name={d.name} size={d.size} hasbin={d.hasbin}
                key={dir + "/" + d.name} idx={idx} playing={idx++ === this.props.playIdx}
                onSelect={this.props.onSelectFile} />);
        });
        const dirNodes = this.props.dirs.map((d) => {
            return (<DirEntry name={d.name} onSelect={this.props.onSelectDir}
                key={d.name} />);
        });
        let parentDir;
        if (dir !== "/")
            parentDir = (<DirEntry name=".." onSelect={this.props.onSelectDir} />);
        return (
            <Grid container style={{ paddingTop: 2, paddingBotton: 2, marginTop: 10 }}>
                <Grid item xs={12}>
                    <Typography variant="display1" paragraph> {this.props.dir} </Typography>
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
        return (<Grid container justify="center" spacing={40} >
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
        </Grid>);
    }
};


//class App extends React.Component {
class App extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            fileList: [],
            dirList: [],
            currentDir: "/",
            text: "",
            editMode: false,
            currentFile: "",
            currentPlayIdx: 0,
            volume: 32,
            chMask: 65535,
            alwaysConvert: false,
            anchorEl: null,
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
                throw ("load title error");
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

            this.setState({ currentPlayIdx: -1 });
            this.setState({ fileList: fileList });
            this.setState({ dirList: dirList });
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
                throw ("load file error");

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

    async saveText(dir, file) {
        if (true) {
            let url = flashAirURLBase + dir + "/" + file;
            console.log("save file url: " + url);
            if (!testMode) {
                const response = await fetch(url, {
                    method: "PUT",
                    body: this.state.text,
                    headers: {
                        "Content-Type": "text/plain"
                    }
                });
                return response.status === 200;
            }
            return true;
        }
        else {
            let form = new FormData();
            let blob = new Blob([this.state.text], { type: "text/plain" });
            console.log("save file: " + file);
            console.log("save text: " + this.state.text);
            form.append("fileName", file);
            form.append("file", blob);

            await this.setCurrentDirAndTime(dir);

            let url = flashAirURLBase + "/upload.cgi";
            //        url = "http://httpbin.org/post";
            console.log("save text:" + url);
            if (!testMode) {
                const response = await fetch(url, { method: "POST", body: form });
                console.log(response);
                return response.status === 200;
            }
        }
        return true;
    }

    async updateCommand(vol, mask) {
        const str = "S" + toHex(vol, 2) + ":" + toHex(mask, 4);
        await sendCommand(str);
    }

    async _playMMLFile(dir, file) {
        if (file === "")
            return false;

        try {
            const path = dir + "/" + file;
            let url = appURLBase + "/player.lua?" + path + "%20" + this.state.volume;
            console.log("play url: " + url);
            if (!testMode) {
                const response = await fetch(url, { method: "get" });
                if (response.status !== 200)
                    throw ("play file error");

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
                    throw ("convert file error");

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
                    throw ("play bin file error");

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

        //        jobQueue.add(async () => { await this._playMMLFile(dir, file) });
        jobQueue.add(async () => {
            canceled = false;
            if (this.state.alwaysConvert || !hasbin) {
                await setTime();
                await this._convert(dir, file);
                await asyncTest("convert wait", 100);
            }
            await this._playBinFile(dir, file);
            if (testMode)
                await asyncTest("playing...", 1000);
            if (!canceled && idx >= 0)
                this.playFileByIdx(++idx);
        });
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
        this.setState({ currentFile: file });
        if (this.state.editMode) {
            this.loadText(this.state.currentDir, file);
        }
        else {
            this.playFile(this.state.currentDir, file, hasbin, idx);
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
        await this.saveText(this.state.currentDir, file);
        this.updateFileList(this.state.currentDir);
    }

    onPlay() {
        console.log("play");
        if (this.state.editMode && this.state.text !== "") {
            (async () => {
                let r = await this.saveText(playerDir, "_tmp.mus");
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
    }

    handleMenu = event => {
        this.setState({ anchorEl: event.currentTarget });
    };
    handleRequestClose = () => {
        this.setState({ anchorEl: null });
    };
    handleCheckChange = name => event => {
        this.setState({ [name]: event.target.checked });
    };

    static propTypes = {
        classes: PropTypes.object.isRequired,
    };

    render() {
        const { classes } = this.props;

        const open = Boolean(this.state.anchorEl);

        return (
            <div className={classes.root}>
                <AppBar position="static" color="default">
                    <Toolbar>
                        <div>
                            <IconButton aria-label="Menu"
                                aria-owns={open ? 'menu-appbar' : null}
                                aria-haspopup="true"
                                onClick={this.handleMenu} >
                                <MenuIcon />
                            </IconButton>
                            <Menu
                                id="menu-appbar"
                                anchorEl={this.state.anchorEl}
                                getContentAnchorEl={null}
                                anchorOrigin={{
                                    vertical: 'top',
                                    horizontal: 'right',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left',
                                }}
                                open={open}
                                onClose={this.handleRequestClose}
                            >
                                <MenuItem onClick={this.handleRequestClose}>
                                    <Checkbox checked={this.state.alwaysConvert}
                                        onChange={this.handleCheckChange('alwaysConvert')}
                                    />
                                    <Typography className={classes.typography}> Convert always</Typography>
                                </MenuItem>
                            </Menu>
                        </div>
                        <Typography variant="title" color="inherit" className={classes.flex}>
                            YMF825Player
	  	                </Typography>
                    </Toolbar>
                </AppBar>
                <div style={{ margin: 10 }}>

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
                    />

                </div>
            </div>);
    };
};

export default withStyles(styles)(App);
