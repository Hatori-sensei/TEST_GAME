@echo off
REM Creates game-gear-neon.patch and applies it with git
powershell -Command "Set-Content -Path 'game-gear-neon.patch' -Value @'
*** Begin Patch
*** Update File: src/routes/Game.vue
@@
-      <div class=\"gear-overlay\">
-        <div class=\"judgment-line\"></div>
-      </div>
+      <div class=\"gear-overlay\">
+        <div class=\"judgment-line\"></div>
+        <div class=\"neon-grain\"></div>
+      </div>
@@
-/* 1. 기어(트랙) 배경 및 양옆 구분선 */
-.gear-overlay {
-  position: absolute;
-  top: 0;
-  left: 50%;
-  transform: translateX(-50%);
-  width: 500px;
-  height: 100%;
-  background: transparent; /* BGA 대비 단색 배경 */
-  border-left: 2px solid rgba(255, 255, 255, 0.25);
-  border-right: 2px solid rgba(255, 255, 255, 0.25);
-  pointer-events: none;
-  z-index: 10;
-}
+/* Neon 스타일: 위치·치수는 변경하지 않음 */
+.gear-overlay {
+  position: absolute;
+  top: 0;
+  left: 50%;
+  transform: translateX(-50%);
+  width: 500px;
+  height: 100%;
+  pointer-events: none;
+  z-index: 10;
+
+  background: linear-gradient(180deg,
+    rgba(0, 10, 20, 0.22) 0%,
+    rgba(0, 240, 255, 0.02) 60%,
+    rgba(0, 0, 0, 0) 100%);
+
+  border-left: 2px solid rgba(0, 240, 255, 0.12);
+  border-right: 2px solid rgba(0, 240, 255, 0.12);
+
+  box-shadow: 0 0 20px rgba(0, 240, 255, 0.06), inset 0 0 30px rgba(0, 240, 255, 0.03);
+  mix-blend-mode: screen;
+  backdrop-filter: blur(1.5px);
+  overflow: visible;
+}
+
+.gear-overlay::before,
+.gear-overlay::after {
+  content: \"\";
+  position: absolute;
+  left: 6px;
+  right: 6px;
+  height: 2px;
+  background: linear-gradient(90deg, transparent, rgba(0,240,255,0.75), transparent);
+  filter: blur(6px);
+  pointer-events: none;
+  opacity: 0.9;
+  animation: neonPulse 3.5s ease-in-out infinite;
+}
+
+.gear-overlay::before { top: 10px; }
+.gear-overlay::after { bottom: 10px; }
+
+.gear-overlay .neon-grain {
+  position: absolute;
+  inset: 0;
+  background-image: repeating-linear-gradient(
+    45deg,
+    rgba(255,255,255,0.006),
+    rgba(255,255,255,0.006) 1px,
+    transparent 1px,
+    transparent 6px
+  );
+  mix-blend-mode: overlay;
+  pointer-events: none;
+  opacity: 0.6;
+}
+
+@keyframes neonPulse {
+  0% { transform: scale(1); opacity: 0.85; }
+  50% { transform: scale(1.01); opacity: 1; }
+  100% { transform: scale(1); opacity: 0.85; }
+}
+
+@media (prefers-reduced-motion: reduce) {
+  .gear-overlay::before,
+  .gear-overlay::after {
+    animation: none;
+    filter: blur(4px);
+  }
+}
*** End Patch
'@ -Encoding UTF8"

if errorlevel 1 (
  echo Failed to write patch file.
  pause
  exit /b 1
)

git apply game-gear-neon.patch
if errorlevel 1 (
  echo git apply failed. Check patch and repository state.
  pause
  exit /b 1
) else (
  echo Patch applied successfully.
)
pause