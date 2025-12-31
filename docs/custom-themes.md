# Creating Custom Themes for Noteworthy

This guide explains how to create and upload custom themes for the Noteworthy music widget.

## Overview

Custom themes are single HTML files with embedded CSS that completely control how your widget looks. You can customize colors, fonts, layouts, animations, and more.

## Getting Started

### Download the Template

1. Go to the config page at `http://localhost:3000/config`
2. In the **Custom Themes** section, click **Download Template**
3. Open the downloaded `theme-template.html` in your code editor

### Upload Your Theme

**Option 1: Web Upload**
1. Go to `http://localhost:3000/config`
2. Click **Choose File** and select your `.html` theme file
3. Click **Upload Theme**

**Option 2: Folder-based**
1. Place your `.html` theme file in the `themes/` folder at the project root
2. The theme will be automatically detected

## Theme Structure

A custom theme file has three main parts:

### 1. Metadata Comment (Optional)

Add theme information at the top of your file:

```html
<!--
  Theme: My Awesome Theme
  Author: Your Name
  Version: 1.0
  Description: A brief description of your theme
-->
```

### 2. CSS Styles

Define your styles inside a `<style>` tag in the `<head>`:

```html
<head>
  <style>
    .widget-container {
      background: linear-gradient(135deg, #1a1a2e, #16213e);
      border-radius: 16px;
      padding: 20px;
    }

    .track-title {
      color: #ff6b6b;
      font-size: 20px;
    }

    /* Add more styles... */
  </style>
</head>
```

### 3. HTML Structure

The `<body>` must contain specific elements with required IDs.

## Required Elements

Your theme **must** include all of these element IDs for the widget to function:

| Element ID | Purpose | Description |
|------------|---------|-------------|
| `widget-container` | Main wrapper | Contains the entire widget |
| `idle-state` | Idle display | Shown when no music is playing |
| `track-content` | Track display | Contains all track information |
| `album-art` | Album artwork | `<img>` element for album cover |
| `track-title` | Song title | Displays the track name |
| `track-artist` | Artist name | Displays the artist |
| `progress-bar` | Progress indicator | Shows playback progress |
| `current-time` | Current position | Displays elapsed time |
| `total-time` | Total duration | Displays track length |
| `visualizer` | Audio visualizer | Container for animated bars |

### Minimal Example

```html
<body>
  <div id="widget-container">
    <!-- Shown when no music is playing -->
    <div id="idle-state">
      No music playing
    </div>

    <!-- Shown when music is playing -->
    <div id="track-content" style="display: none;">
      <img id="album-art" alt="">
      <div id="track-title"></div>
      <div id="track-artist"></div>
      <div id="progress-bar"></div>
      <span id="current-time"></span>
      <span id="total-time"></span>
      <div id="visualizer"></div>
    </div>
  </div>
</body>
```

## Optional Elements

These elements are optional but provide additional functionality:

| Element ID | Purpose |
|------------|---------|
| `album-art-placeholder` | Shown when no album art is available |
| `playing-indicator` | Shows play/pause state (add class `paused` when paused) |

## CSS Classes Reference

The widget JavaScript automatically adds/removes these classes:

| Class | Applied To | When |
|-------|-----------|------|
| `hidden` | `#album-art` | No album art available |
| `visible` | `#album-art-placeholder` | No album art available |
| `paused` | `#playing-indicator` | Track is paused |
| `paused` | `#visualizer` | Track is paused |
| `scrolling` | `.track-title`, `.track-artist` | Text overflows container |

## Styling the Visualizer

The visualizer creates animated bars automatically. Style them with:

```css
/* Container */
.visualizer {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 40px;
}

/* Individual bars (created dynamically) */
.visualizer-bar {
  width: 4px;
  background: linear-gradient(to top, #ff6b6b, #feca57);
  border-radius: 2px;
}

/* Paused state */
.visualizer.paused .visualizer-bar {
  height: 4px !important;
  opacity: 0.5;
}
```

## Styling the Progress Bar

```css
.progress-bar-container {
  width: 100%;
  height: 6px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: #1DB954;
  border-radius: 3px;
  transition: width 0.3s linear;
  /* Width is set dynamically via JavaScript */
}
```

## Text Overflow Animation

For long titles/artists, add scroll animation:

```css
.track-title, .track-artist {
  white-space: nowrap;
  overflow: hidden;
}

.track-title.scrolling, .track-artist.scrolling {
  animation: scroll-text 10s linear infinite;
}

@keyframes scroll-text {
  0%, 10% { transform: translateX(0); }
  90%, 100% { transform: translateX(calc(-100% + 200px)); }
}
```

## Theme Examples

### Minimal Dark Theme

```css
.widget-container {
  background: #121212;
  padding: 16px;
  font-family: 'Inter', sans-serif;
}

.track-title {
  color: #fff;
  font-size: 16px;
  font-weight: 600;
}

.track-artist {
  color: #b3b3b3;
  font-size: 14px;
}

.progress-bar {
  background: #1DB954;
}
```

### Neon Glow Theme

```css
.widget-container {
  background: linear-gradient(135deg, #0d0221 0%, #1a0a3e 100%);
  border: 2px solid #ff00ff;
  box-shadow: 0 0 20px rgba(255, 0, 255, 0.5);
}

.track-title {
  color: #00ffff;
  text-shadow: 0 0 10px #00ffff;
}

.track-artist {
  color: #ff00ff;
  text-shadow: 0 0 10px #ff00ff;
}

.progress-bar {
  background: linear-gradient(90deg, #ff00ff, #00ffff);
  box-shadow: 0 0 10px rgba(255, 0, 255, 0.8);
}
```

## Using Web Fonts

You can import Google Fonts or other web fonts:

```html
<head>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
  <style>
    .widget-container {
      font-family: 'Poppins', sans-serif;
    }
  </style>
</head>
```

## Preview Mode

When previewing in the config page, the `body` element gets a `preview` class. Use this to add a background that's only visible during preview:

```css
body.preview {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

In OBS, the background will be transparent (as configured in your browser source).

## Security Notes

For security, the following are **not allowed** in custom themes:

- External JavaScript files (`<script src="...">`)
- Inline event handlers (`onclick`, `onerror`, etc.)
- `javascript:` URLs

Themes are sanitized on upload to remove potentially dangerous content.

## File Size Limit

Custom themes must be under **512KB**. This should be plenty for HTML and CSS. If you need images, use external URLs or base64-encode small icons.

## Troubleshooting

### Theme not loading?
- Check that all required element IDs are present
- Verify the file has a `.html` extension
- Check the browser console for errors

### Styles not applying?
- Make sure your CSS selectors match the element IDs
- Check for typos in class names
- Use browser dev tools to inspect elements

### Visualizer not animating?
- Ensure `#visualizer` element exists
- Check that visualizer CSS is properly defined
- The `widget-base.css` file provides default animations

## Using Your Theme in OBS

1. Upload or create your theme
2. Click **Use** next to your theme in the config page
3. Copy the generated Widget URL
4. In OBS, add a Browser Source with:
   - URL: Your widget URL (includes `?customTheme=your-theme-name`)
   - Width: 450
   - Height: 150
   - Check "Shutdown source when not visible" (optional)
