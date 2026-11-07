# PACKER — Physical AI Hackathon MVP

A functional local web app for an AI-assisted school, friends and vacation packing demo.

## What is actually working?

- Prompt → packing list, with an offline rule-based fallback.
- Claude prompt understanding when an Anthropic API key is available.
- Actual Open-Meteo weather forecast by place/date (including available days of a vacation), automatically adding an umbrella or jacket when conditions warrant it.
- Timeline (approximate times unless the user/Claude provides times), packing order, visual progress, and physical confirmation buttons.
- Optional live webcam YOLO detection and annotated bounding boxes, with recognized object status displayed beside the packing queue.

**Not implemented:** Automatic robot movement, automatic confirmation that an item is inside a bag, recognition of all items (e.g., toothbrush). The camera merely detects some object classes. The team must operate the arms and confirm packed status.

## Run (Windows Command Prompt)

Install Python 3.10+ first. Open Command Prompt in the folder with `app.py`.

```bat
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000** in your browser. The basic application works without a Claude API key. Weather requires an internet connection.

## Enable Claude (optional)

In the *same Command Prompt*, before launching the server:

```bat
set ANTHROPIC_API_KEY=YOUR_ACTUAL_KEY
python app.py
```

Replace `YOUR_ACTUAL_KEY` with your own key. **Do not paste or put the API key in the frontend, a screenshot, or a shared repository.** The default model is `claude-haiku-4-5-20251001` and can be overridden with `PACKER_CLAUDE_MODEL`. Claude API usage may incur charges.

## Enable actual webcam detection (optional)

With your virtual environment active, stop the server with Ctrl+C and run:

```bat
pip install -r requirements-vision.txt
python app.py
```

Click **Start camera**. The default YOLO11n weights download on first use (requires internet). Packer now tries Windows DirectShow, Media Foundation, and default camera backends, and camera indices 0 and 1. The webcam must not already be in use. To force another camera, run `set PACKER_CAMERA=1` in the same Command Prompt before starting the server.

For Windows built-in webcams: first test the Windows **Camera** app. Enable **Settings → Privacy & security → Camera → Camera access** and **Let desktop apps access your camera**. Close Camera, Teams, Discord, and Zoom before starting Packer. If the vision panel shows an error, it comes from the Python process (browser camera permission settings are not used by this app).

Detected COCO classes include `book`, `backpack`, `bottle`, `umbrella`, and `sports ball`. `pencil case`, `toothbrush`, and `towel` have no dedicated classes. The app never claims those are detected.

## Faster camera mode (this edition)

This version removes the previous **850 ms camera-display bottleneck**. It uses a continuous MJPEG preview, runs the YOLO11n model at 320-pixel inference size by default (was 480), requests 640x480 webcam capture, and displays measured processing FPS/inference latency below the preview.

The camera may still be slow on CPU-only machines; the FPS label shows the actual processed frame rate, not a promise of 30 FPS. A built-in laptop webcam is fine. For better recognition of smaller objects, try a larger inference size after checking speed.

To choose the size in Windows Command Prompt, stop the server (Ctrl+C) and run:

```bat
set PACKER_YOLO_SIZE=256
python app.py
```

`256` is faster but may miss smaller objects. Use `320` for a balance or `480` for better detail. This setting applies to the Python vision process, **not** a browser video size. No need to retrain a model. Keep `yolo11n.pt` for fastest standard YOLO11 inference.

## Five-minute demo flow

1. Enter: "Tomorrow I have math and science, then I'm playing football with friends."
2. Set the date and city; generate the packing plan and show the activity timeline.
3. Explain any weather additions (only if a real forecast was available).
4. Start webcam YOLO, show a book/bottle/football; point at detected boxes.
5. Teleoperate the robotic arms to move one or two *lightweight* demo objects into a bag fixed open on a table.
6. Click **Packed** after each successful movement. Show progress increasing.
7. Switch to **Vacation**, enter "I'm going to Kyoto for three days" and generate again.

## Architecture

`app.py` — Flask API, weather lookup, Claude/fallback planning, optional background vision thread.

`templates/index.html` — main page.

`static/app.js` — frontend state and rendering.

`static/style.css` — responsive UI styles.

Security: local-only Flask server by default. Don't expose an unprotected developer server to the internet.

Weather: Open-Meteo forecast/geocoding API. See https://open-meteo.com/en/docs and https://open-meteo.com/en/docs/geocoding-api.

Claude: https://platform.claude.com/docs/en/api/python/messages/create.

YOLO: https://docs.ultralytics.com/usage/python/.

## New: Timetable Reader (時間割)

Packer now supports Monday–Friday school timetables with up to six class periods:

1. Scroll to **時間割 Reader** and type subjects into the grid. Subjects are saved in the current browser's localStorage.
2. Or upload a JPG, PNG or WebP photo; **Claude Vision** will read the timetable if `ANTHROPIC_API_KEY` is configured. Image reading is optional and may be imperfect. Check the extracted subjects in the grid before trusting it.
3. A third option, **Capture YOLO camera frame**, can take a still of the existing MJPEG webcam preview and submit it for Claude reading. Point the camera at a clear timetable; printed photos usually work better than a grainy webcam still. **YOLO does not read text**.
4. Set the **date** to a school day (Monday–Friday). In **Auto** or **School** mode, tick **Use timetable when planning for school**, then generate.
5. The selected day's classes are added to the school event, and Packer adds suggested materials automatically. PE adds PE clothes, Math adds a Math book, etc. Unrecognized subjects get a generic materials suggestion. Adjust classes and item descriptions as needed for your school.

On Saturday Nov 7, 2026, the following day is Sunday; select Monday Nov 9 to test a weekday timetable.

Photo uploads are sent to the configured Anthropic API when Claude reading is enabled. Avoid using identifiable private student information in test images. Uploaded images are processed for the request and are not saved by this app. Without an API key, manual timetable entry works normally.

To replace your previous build: copy `app.py`, `templates/index.html`, `static/app.js`, and `static/style.css` into the existing project, or run the new ZIP as a standalone folder. Keep the existing virtual environment if you're only replacing files.


## New: micro:bit physical confirmation remote (optional)

The micro:bit **does not automatically detect whether an item is in the bag**. It is a convenient handheld **operator confirmation button**, replacing mouse clicks. This is intentional: YOLO seeing an object disappear is not proof that the robot placed it successfully.

1. Open https://python.microbit.org/ and flash the included `microbit_controller.py` to the micro:bit (the file is MicroPython for the micro:bit, not Python running on your PC).
2. Connect micro:bit to your Windows laptop using a **USB data cable**. Close serial monitors / the micro:bit editor serial console after flashing.
3. With your PC virtualenv active, run `pip install -r requirements-microbit.txt`.
4. Restart the Packer app using `python app.py` and refresh the browser with Ctrl+F5.
5. In the **micro:bit · Packing confirmation** panel, leave `auto` selected and click **Connect micro:bit**. If auto detection fails, find the port in Windows Device Manager → Ports (COM & LPT), then enter e.g. `COM4`.
6. Generate a packing plan; move the next item into the bag with the robot; inspect physically. **A** marks the next unpacked item as packed; **B** shows a failure message and does not mark it packed. You can still use the mouse buttons in the packing queue.

The app talks to the micro:bit using local Python serial at 115200 baud. It never controls the robot motors. The file `microbit_controller.py` must be flashed onto the micro:bit; it is not executed from Packer's Windows terminal. If the port is already in use, close all other serial tools and try again.

### If you want automatic verification later

A micro:bit itself does **not** have a weight sensor. An additional load cell and amplifier wired to it (or a compatible external force sensor beneath a rigid bag support) could indicate a weight change; camera/object identity and mechanical stability would still require separate verification. A camera looking into an unobstructed bag can sometimes help verify a specific object. These are stretch goals and are not included in this build.

## New: visual bag zone (v1.2)

This version adds a **bag-area visual cue** to the existing laptop webcam and micro:bit flow, with no additional sensors required:

1. Generate a packing plan and start the YOLO camera. Aim the laptop webcam so the **table, intended object, and open bag** are all in view. (This may be hard with a built-in webcam; reposition the laptop carefully. If the bag is off camera, use manual confirmation instead.)
2. Click **Draw bag area**, then drag over the *open bag area* in the camera feed. This purple region is saved in browser localStorage.
3. Make sure the selected item is first visible **outside** the purple rectangle. Move it into the rectangle using the robot. If YOLO sees the matching class there in **two distinct processed frames**, the UI says **Possible placement**.
4. Inspect the bag directly. Press **A** on the micro:bit or click **Packed ✓** only after verifying it stayed inside. Use **B** to retry.

**This is not automatic packing verification.** YOLO detects categories, not item identity, and a bounding box crossing a selected region does not prove it landed in the bag. A bag can occlude the item. The system intentionally NEVER marks anything packed from vision alone. Book A vs Book B cannot be reliably distinguished with a standard COCO model. With multiple objects of the same YOLO class, a candidate can be wrong. It is guidance for your live demo, with the micro:bit as the final confirmation.

The UI prevents duplicate camera polls from counting as separate YOLO frames, and the visual tracking is computed client-side without additional YOLO model runs. Its responsiveness is limited by measured FPS.

**Upgrading:** Stop `python app.py` with Ctrl+C, copy `app.py`, `templates/index.html`, `static/app.js`, `static/style.css` from this ZIP over your existing files, restart and refresh with Ctrl+F5. Keep your microbit_controller.py as is.
