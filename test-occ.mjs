// Test script to verify OpenCascade.js primitive constructors
import initOpenCascade from "opencascade.js";

async function test() {
  console.log("Loading OpenCascade.js...");
  const oc = await initOpenCascade();
  console.log("OpenCascade.js loaded!");

  // List available BRepPrimAPI constructors
  const boxConstructors = Object.keys(oc).filter(k => k.includes("BRepPrimAPI_MakeBox"));
  const cylConstructors = Object.keys(oc).filter(k => k.includes("BRepPrimAPI_MakeCylinder"));
  const sphereConstructors = Object.keys(oc).filter(k => k.includes("BRepPrimAPI_MakeSphere"));
  const coneConstructors = Object.keys(oc).filter(k => k.includes("BRepPrimAPI_MakeCone"));

  console.log("\n=== Available Constructors ===");
  console.log("Box:", boxConstructors.join(", "));
  console.log("Cylinder:", cylConstructors.join(", "));
  console.log("Sphere:", sphereConstructors.join(", "));
  console.log("Cone:", coneConstructors.join(", "));

  // Test each box constructor
  console.log("\n=== Testing Box Constructors ===");
  for (const name of boxConstructors) {
    if (name === "BRepPrimAPI_MakeBox") continue; // Skip base class
    try {
      let box;
      if (name === "BRepPrimAPI_MakeBox_1") {
        box = new oc[name]();
        console.log(`${name}(): IsDone=${box.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeBox_2") {
        box = new oc[name](50, 50, 50);
        console.log(`${name}(50, 50, 50): IsDone=${box.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeBox_3") {
        const p = new oc.gp_Pnt_3(0, 0, 0);
        box = new oc[name](p, 50, 50, 50);
        console.log(`${name}(gp_Pnt, 50, 50, 50): IsDone=${box.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeBox_4") {
        const p1 = new oc.gp_Pnt_3(0, 0, 0);
        const p2 = new oc.gp_Pnt_3(50, 50, 50);
        box = new oc[name](p1, p2);
        console.log(`${name}(gp_Pnt, gp_Pnt): IsDone=${box.IsDone()}`);
      }
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`);
    }
  }

  // Test cylinder constructors
  console.log("\n=== Testing Cylinder Constructors ===");
  for (const name of cylConstructors) {
    if (name === "BRepPrimAPI_MakeCylinder") continue;
    try {
      let cyl;
      if (name === "BRepPrimAPI_MakeCylinder_1") {
        cyl = new oc[name]();
        console.log(`${name}(): IsDone=${cyl.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeCylinder_2") {
        cyl = new oc[name](25, 50);
        console.log(`${name}(25, 50): IsDone=${cyl.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeCylinder_3") {
        cyl = new oc[name](25, 50, Math.PI * 2);
        console.log(`${name}(25, 50, 2PI): IsDone=${cyl.IsDone()}`);
      }
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`);
    }
  }

  // Test sphere constructors
  console.log("\n=== Testing Sphere Constructors ===");
  for (const name of sphereConstructors) {
    if (name === "BRepPrimAPI_MakeSphere") continue;
    try {
      let sphere;
      if (name === "BRepPrimAPI_MakeSphere_1") {
        sphere = new oc[name]();
        console.log(`${name}(): IsDone=${sphere.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeSphere_2") {
        sphere = new oc[name](25);
        console.log(`${name}(25): IsDone=${sphere.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeSphere_3") {
        sphere = new oc[name](25, Math.PI);
        console.log(`${name}(25, PI): IsDone=${sphere.IsDone()}`);
      }
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`);
    }
  }

  // Test cone constructors
  console.log("\n=== Testing Cone Constructors ===");
  for (const name of coneConstructors) {
    if (name === "BRepPrimAPI_MakeCone") continue;
    try {
      let cone;
      if (name === "BRepPrimAPI_MakeCone_1") {
        cone = new oc[name]();
        console.log(`${name}(): IsDone=${cone.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeCone_2") {
        cone = new oc[name](25, 0, 50);
        console.log(`${name}(25, 0, 50): IsDone=${cone.IsDone()}`);
      } else if (name === "BRepPrimAPI_MakeCone_3") {
        cone = new oc[name](25, 0, 50, Math.PI * 2);
        console.log(`${name}(25, 0, 50, 2PI): IsDone=${cone.IsDone()}`);
      }
    } catch (e) {
      console.log(`${name}: ERROR - ${e.message}`);
    }
  }

  console.log("\n=== Done ===");
}

test().catch(console.error);
