# FL Studio MCP Server

Control FL Studio using natural language through Claude AI via the Model Context Protocol (MCP).

## Features

- **Transport Control**: Play, stop, record, get playback state
- **Pattern Management**: Create, select, and rename patterns
- **Channel Rack**: View all channels with volume, pan, mute status
- **Mixer Info**: Get mixer track information

## Requirements

- **FL Studio** (Windows/macOS)
- **Node.js** 18+
- **Virtual MIDI Driver**:
  - Windows: [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
  - macOS: Use IAC Driver (built-in) - see instructions below
  - Linux: Use ALSA virtual MIDI ports

## Installation

### 1. Clone and Build

```bash
git clone https://github.com/your-repo/fl-studio-mcp.git
cd fl-studio-mcp
npm install
npm run build
```

### 2. Set Up Virtual MIDI Ports

#### Windows (loopMIDI)

1. Install [loopMIDI](https://www.tobias-erichsen.de/software/loopmidi.html)
2. Create two ports:
   - `FL Bridge In` (commands to FL Studio)
   - `FL Bridge Out` (responses from FL Studio)

#### macOS (IAC Driver)

1. Open **Audio MIDI Setup** (Applications > Utilities)
2. Show MIDI Studio (Window > Show MIDI Studio)
3. Double-click **IAC Driver**
4. Check "Device is online"
5. Add two ports:
   - `FL Bridge In`
   - `FL Bridge Out`

#### Linux (ALSA)

```bash
sudo modprobe snd-virmidi
# Creates virtual MIDI ports accessible via ALSA
```

### 3. Install FL Bridge Script

Copy the `fl-bridge` folder to FL Studio's Hardware folder:

- **Windows**: `Documents\Image-Line\FL Studio\Settings\Hardware\FLBridge\`
- **macOS**: `Documents/Image-Line/FL Studio/Settings/Hardware/FLBridge/`

The folder should contain:
```
FLBridge/
├── device_FLBridge.py
├── protocol/
│   ├── __init__.py
│   ├── sysex.py
│   └── commands.py
└── handlers/
    ├── __init__.py
    ├── transport.py
    ├── state.py
    └── patterns.py
```

### 4. Configure FL Studio MIDI Settings

1. Open FL Studio
2. Go to **OPTIONS > MIDI settings**
3. Click **"Rescan MIDI devices"** or **"Update MIDI scripts"**

**Input Section:**
- Select `FL Bridge In`
- Set **Controller type** to `FL Bridge`
- Assign **Port** `0`

**Output Section:**
- Select `FL Bridge Out`
- Assign **Port** `0`

> **Critical**: Both input and output must have the **same port number** (e.g., Port 0) for FL Studio to link them correctly.

### 5. Configure Claude Code

Create `.mcp.json` in your project directory:

```json
{
  "mcpServers": {
    "fl-studio": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/fl-studio-mcp/dist/index.js"],
      "env": {
        "FL_PORT_TO_FL": "FL Bridge In",
        "FL_PORT_FROM_FL": "FL Bridge Out"
      }
    }
  }
}
```

**Environment Variables:**

| Variable | Description | Default |
|----------|-------------|---------|
| `FL_PORT_TO_FL` | MIDI port for sending commands to FL Studio | `FL Bridge In` |
| `FL_PORT_FROM_FL` | MIDI port for receiving responses from FL Studio | `FL Bridge Out` |
| `FL_DEBUG` | Enable debug logging (`1` or `true`) | disabled |
| `FL_DEBUG_FILE` | Custom path for debug log file | `./fl-studio-mcp-debug.log` |

> Note: Use full path to `node` if using a version manager like fnm or nvm.

## Usage

Once configured, Claude can control FL Studio:

```
"Start playing the project"
"Stop playback"
"Show me all the channels"
"Create a new pattern called 'Intro'"
"What's the current transport state?"
```

## Available Tools

| Tool | Description |
|------|-------------|
| `transport_play` | Start playback |
| `transport_stop` | Stop playback |
| `transport_record` | Toggle recording |
| `transport_state` | Get current transport state |
| `get_channels` | List all channels |
| `get_mixer` | Get mixer track info |
| `get_patterns` | List all patterns |
| `pattern_select` | Select a pattern by index |
| `pattern_create` | Create a new pattern |
| `pattern_rename` | Rename a pattern |

## Troubleshooting

### "FL Bridge" not appearing in Controller type dropdown

- Ensure `device_FLBridge.py` has `# name=FL Bridge` as the first line
- Click "Update MIDI scripts" in MIDI settings
- Restart FL Studio if needed

### Commands timeout

1. Check FL Studio Script output (View > Script output) for errors
2. Verify both ports have the **same port number** in MIDI settings
3. Check loopMIDI shows data flowing (Total data counters)

### MCP server won't connect

- Verify virtual MIDI ports are running
- Check port names match exactly (case-sensitive)
- Use full path to node.exe if using version managers

### Debug Logging

Enable debug logging to troubleshoot issues:

```json
"env": {
  "FL_PORT_TO_FL": "FL Bridge In",
  "FL_PORT_FROM_FL": "FL Bridge Out",
  "FL_DEBUG": "1"
}
```

Logs are written to `fl-studio-mcp-debug.log` with automatic rotation (max 1000 lines).

## Architecture

```
┌─────────────┐    stdio     ┌─────────────┐    MIDI SysEx    ┌─────────────┐
│  Claude AI  │◄────────────►│  MCP Server │◄────────────────►│  FL Studio  │
│             │              │  (Node.js)  │                  │  (Python)   │
└─────────────┘              └─────────────┘                  └─────────────┘
                                   │                                │
                                   ▼                                ▼
                             loopMIDI/IAC                    FL Bridge Script
                             Virtual MIDI                   (device_FLBridge.py)
```

## License

MIT
