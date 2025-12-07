// Run primitive tests in headless browser by triggering box creation in the app
import { chromium } from 'playwright';

async function runTests() {
  console.log('Launching headless browser...');

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console output
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    if (text.includes('[OCC]')) {
      console.log('OCC:', text);
    }
  });

  page.on('pageerror', err => {
    console.error('Page error:', err.message);
  });

  try {
    console.log('Navigating to main app...');
    await page.goto('http://localhost:3011/', {
      timeout: 60000,
      waitUntil: 'domcontentloaded'
    });

    // Wait for the app to load and OCC to initialize
    console.log('Waiting for OCC to load...');
    await page.waitForTimeout(10000); // Give OCC time to load WASM

    console.log('Looking for Box button in toolbar...');

    // Try to find and click the box button in the toolbar
    // First let's see what's in the toolbar by getting the page content
    const toolbarExists = await page.locator('button').count();
    console.log(`Found ${toolbarExists} buttons on the page`);

    // Look for buttons with specific text or icons
    const buttons = await page.locator('button').allTextContents();
    console.log('Button texts:', buttons.slice(0, 20));

    // Try clicking a button that might create a box
    // The toolbar should have primitives buttons
    const boxButton = page.locator('button[title*="Box"], button:has-text("Box")').first();
    if (await boxButton.count() > 0) {
      console.log('Found Box button, clicking...');
      await boxButton.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Box button not found, trying to trigger via console...');

      // Execute test code in the browser context
      await page.evaluate(async () => {
        // Wait for the store to be available
        const maxWait = 30;
        let waited = 0;
        while (!window.__CAD_STORE__ && waited < maxWait) {
          await new Promise(r => setTimeout(r, 1000));
          waited++;
        }

        const store = window.__CAD_STORE__;
        if (store) {
          console.log('[TEST] Store found, triggering box creation...');
          const state = store.getState();
          if (state.startPendingPrimitive) {
            state.startPendingPrimitive('box');
            console.log('[TEST] Started pending box primitive');

            // Wait a moment then confirm
            await new Promise(r => setTimeout(r, 500));
            if (state.confirmPendingPrimitive) {
              try {
                state.confirmPendingPrimitive();
                console.log('[TEST] Confirmed pending primitive');
              } catch (e) {
                console.log('[TEST] Error confirming primitive:', e.message);
              }
            }
          }
        } else {
          console.log('[TEST] Store not found');
        }
      });

      await page.waitForTimeout(3000);
    }

    console.log('\n=== Console Logs with [OCC] ===');
    const occLogs = logs.filter(l => l.includes('[OCC]'));
    occLogs.forEach(l => console.log(l));

    console.log('\n=== All Error/Warning Logs ===');
    const errorLogs = logs.filter(l => l.toLowerCase().includes('error') || l.toLowerCase().includes('failed'));
    errorLogs.forEach(l => console.log(l));

    console.log('\n=== Test Results Summary ===');
    console.log(`Total console messages: ${logs.length}`);
    console.log(`OCC-related messages: ${occLogs.length}`);
    console.log(`Error messages: ${errorLogs.length}`);

    // Check if any approach worked
    const shapeCreated = logs.some(l => l.includes('Shape created') || l.includes('Got shape from approach'));
    const isDoneFalse = logs.some(l => l.includes('IsDone: false') || l.includes('IsDone:false'));
    const isDoneTrue = logs.some(l => l.includes('IsDone: true') || l.includes('IsDone:true'));

    if (shapeCreated || isDoneTrue) {
      console.log('\n SUCCESS: Shape was created!');
    } else if (isDoneFalse) {
      console.log('\n FAILURE: IsDone() returned false - constructor not working correctly');
    } else if (occLogs.length === 0) {
      console.log('\n INFO: No OCC logs found - primitive creation may not have been triggered');
    }

  } catch (error) {
    console.error('Test error:', error.message);
  }

  await browser.close();
}

runTests().catch(console.error);
