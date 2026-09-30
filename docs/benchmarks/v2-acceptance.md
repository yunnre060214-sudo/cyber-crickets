# Cyber Crickets 2.0 实测验收

时间：2026-09-30T17:58:15.619Z。完成 148/148，执行错误 0。
源码 SHA256：1635b6491de1b2f27d62d16c57001192506f3ec3b128f0cb050c64e76d7dfe30；构建目录：1635b6491de1。
环境：v24.21.0 / linux / AMD EPYC 7763 64-Core Processor。

固定矩阵：8 个独立种子 × 4 地图 × 4 出生位 × 60 秒，另有 180/400 秒各 4 局，三个新策略对 strongest 各 2 种子换边共 12 局。种子在源码冻结后生成，本次没有按结果调参。

128 局四方第一名次数（同分分别计入）：strongest 104，pathfinder 6，boundary 0，ucb 18。

这不是样本外必胜或相对 1.0 提升百分比的证据；地图与策略组合限定了适用范围。播放速度与机器耗时不进入结果。完整配置、得分、败局、哈希和每局实测时间见 JSON。

## 逐局结果

| 局 | 地图 | 时长 | 轮换 | 第一名 | 各方 VP |
|---|---|---:|---:|---|---|
| holdout/0 | plain | 60 | 0 | strongest | strongest 81.903 / ucb 54.591 / boundary 38.868 / pathfinder 36.081 |
| holdout/1 | plain | 60 | 1 | strongest | strongest 57.177 / pathfinder 47.004 / boundary 40.524 / ucb 30.564 |
| holdout/2 | plain | 60 | 2 | strongest | strongest 84.099 / ucb 38.606 / boundary 30.950 / pathfinder 14.980 |
| holdout/3 | plain | 60 | 3 | strongest | strongest 79.347 / ucb 54.009 / boundary 29.522 / pathfinder 19.540 |
| holdout/4 | basin | 60 | 0 | ucb | ucb 52.163 / strongest 51.775 / boundary 36.403 / pathfinder 31.655 |
| holdout/5 | basin | 60 | 1 | strongest | strongest 58.579 / pathfinder 48.860 / boundary 40.554 / ucb 28.706 |
| holdout/6 | basin | 60 | 2 | strongest | strongest 67.816 / ucb 38.606 / boundary 30.950 / pathfinder 14.362 |
| holdout/7 | basin | 60 | 3 | strongest | strongest 76.551 / ucb 50.807 / boundary 26.771 / pathfinder 20.507 |
| holdout/8 | canyon | 60 | 0 | strongest | strongest 87.564 / ucb 48.121 / boundary 39.723 / pathfinder 31.053 |
| holdout/9 | canyon | 60 | 1 | strongest | strongest 117.181 / ucb 52.128 / pathfinder 42.211 / boundary 32.935 |
| holdout/10 | canyon | 60 | 2 | strongest | strongest 94.613 / pathfinder 59.451 / ucb 35.897 / boundary 26.959 |
| holdout/11 | canyon | 60 | 3 | strongest | strongest 126.243 / ucb 46.772 / boundary 37.707 / pathfinder 32.284 |
| holdout/12 | ring | 60 | 0 | strongest | strongest 52.416 / ucb 48.550 / boundary 37.025 / pathfinder 13.344 |
| holdout/13 | ring | 60 | 1 | strongest | strongest 70.479 / ucb 51.638 / boundary 39.196 / pathfinder 28.972 |
| holdout/14 | ring | 60 | 2 | strongest | strongest 75.811 / pathfinder 58.651 / ucb 32.439 / boundary 30.709 |
| holdout/15 | ring | 60 | 3 | strongest | strongest 104.936 / pathfinder 33.676 / ucb 33.291 / boundary 29.683 |
| holdout/16 | plain | 60 | 0 | strongest | strongest 85.249 / ucb 64.043 / boundary 39.882 / pathfinder 36.594 |
| holdout/17 | plain | 60 | 1 | strongest | strongest 108.168 / pathfinder 52.084 / ucb 42.861 / boundary 37.040 |
| holdout/18 | plain | 60 | 2 | strongest | strongest 103.851 / ucb 52.913 / boundary 36.411 / pathfinder 21.410 |
| holdout/19 | plain | 60 | 3 | strongest | strongest 117.241 / ucb 31.490 / pathfinder 28.399 / boundary 27.523 |
| holdout/20 | basin | 60 | 0 | ucb | ucb 71.692 / strongest 47.365 / boundary 36.344 / pathfinder 34.056 |
| holdout/21 | basin | 60 | 1 | ucb | ucb 62.579 / pathfinder 49.931 / strongest 44.685 / boundary 29.123 |
| holdout/22 | basin | 60 | 2 | strongest | strongest 66.358 / ucb 44.079 / pathfinder 40.340 / boundary 35.625 |
| holdout/23 | basin | 60 | 3 | strongest | strongest 75.233 / ucb 68.035 / boundary 28.317 / pathfinder 25.710 |
| holdout/24 | canyon | 60 | 0 | strongest | strongest 84.161 / ucb 62.844 / boundary 44.679 / pathfinder 26.195 |
| holdout/25 | canyon | 60 | 1 | strongest | strongest 87.462 / pathfinder 44.976 / ucb 42.074 / boundary 40.572 |
| holdout/26 | canyon | 60 | 2 | strongest | strongest 89.149 / ucb 41.340 / boundary 40.610 / pathfinder 26.383 |
| holdout/27 | canyon | 60 | 3 | strongest | strongest 104.012 / ucb 60.734 / boundary 36.796 / pathfinder 23.425 |
| holdout/28 | ring | 60 | 0 | strongest | strongest 87.597 / ucb 64.026 / boundary 41.797 / pathfinder 33.408 |
| holdout/29 | ring | 60 | 1 | strongest | strongest 108.074 / pathfinder 53.716 / ucb 44.615 / boundary 36.440 |
| holdout/30 | ring | 60 | 2 | strongest | strongest 90.770 / ucb 46.205 / boundary 32.943 / pathfinder 32.300 |
| holdout/31 | ring | 60 | 3 | strongest | strongest 113.798 / ucb 43.390 / boundary 31.913 / pathfinder 29.538 |
| holdout/32 | plain | 60 | 0 | strongest | strongest 72.008 / ucb 46.644 / pathfinder 43.455 / boundary 31.751 |
| holdout/33 | plain | 60 | 1 | strongest | strongest 91.025 / pathfinder 56.357 / boundary 48.078 / ucb 32.546 |
| holdout/34 | plain | 60 | 2 | strongest | strongest 76.893 / ucb 51.283 / boundary 34.056 / pathfinder 26.123 |
| holdout/35 | plain | 60 | 3 | strongest | strongest 99.646 / ucb 50.736 / boundary 38.817 / pathfinder 37.459 |
| holdout/36 | basin | 60 | 0 | ucb | ucb 62.869 / strongest 52.286 / pathfinder 44.043 / boundary 29.212 |
| holdout/37 | basin | 60 | 1 | pathfinder | pathfinder 63.780 / strongest 56.447 / boundary 41.553 / ucb 31.586 |
| holdout/38 | basin | 60 | 2 | strongest | strongest 64.334 / ucb 51.164 / boundary 34.053 / pathfinder 21.345 |
| holdout/39 | basin | 60 | 3 | ucb | ucb 67.044 / strongest 65.262 / pathfinder 34.534 / boundary 26.601 |
| holdout/40 | canyon | 60 | 0 | strongest | strongest 72.576 / pathfinder 60.018 / ucb 46.820 / boundary 44.111 |
| holdout/41 | canyon | 60 | 1 | strongest | strongest 70.421 / ucb 60.596 / pathfinder 55.933 / boundary 43.610 |
| holdout/42 | canyon | 60 | 2 | strongest | strongest 104.080 / pathfinder 47.876 / ucb 44.901 / boundary 35.589 |
| holdout/43 | canyon | 60 | 3 | strongest | strongest 81.460 / pathfinder 60.822 / boundary 36.536 / ucb 34.254 |
| holdout/44 | ring | 60 | 0 | ucb | ucb 58.079 / strongest 52.130 / pathfinder 43.944 / boundary 35.635 |
| holdout/45 | ring | 60 | 1 | strongest | strongest 82.907 / pathfinder 60.515 / boundary 47.489 / ucb 33.550 |
| holdout/46 | ring | 60 | 2 | ucb | ucb 52.614 / strongest 49.269 / pathfinder 37.812 / boundary 35.649 |
| holdout/47 | ring | 60 | 3 | strongest | strongest 68.531 / ucb 57.966 / pathfinder 34.892 / boundary 24.365 |
| holdout/48 | plain | 60 | 0 | strongest | strongest 104.415 / ucb 57.816 / pathfinder 43.990 / boundary 32.198 |
| holdout/49 | plain | 60 | 1 | pathfinder | pathfinder 67.476 / strongest 65.423 / boundary 31.379 / ucb 26.311 |
| holdout/50 | plain | 60 | 2 | strongest | strongest 76.760 / ucb 62.688 / boundary 29.865 / pathfinder 20.014 |
| holdout/51 | plain | 60 | 3 | strongest | strongest 110.071 / ucb 60.506 / pathfinder 37.078 / boundary 25.378 |
| holdout/52 | basin | 60 | 0 | strongest | strongest 71.738 / ucb 53.413 / pathfinder 42.011 / boundary 29.826 |
| holdout/53 | basin | 60 | 1 | strongest | strongest 73.588 / ucb 59.629 / pathfinder 44.969 / boundary 25.196 |
| holdout/54 | basin | 60 | 2 | strongest | strongest 61.473 / pathfinder 60.378 / ucb 54.926 / boundary 30.250 |
| holdout/55 | basin | 60 | 3 | strongest | strongest 84.993 / ucb 78.842 / pathfinder 44.364 / boundary 25.322 |
| holdout/56 | canyon | 60 | 0 | strongest | strongest 101.800 / pathfinder 50.400 / ucb 47.105 / boundary 28.277 |
| holdout/57 | canyon | 60 | 1 | strongest | strongest 67.997 / pathfinder 61.729 / boundary 52.509 / ucb 29.805 |
| holdout/58 | canyon | 60 | 2 | strongest | strongest 73.441 / ucb 64.677 / boundary 42.309 / pathfinder 31.065 |
| holdout/59 | canyon | 60 | 3 | strongest | strongest 95.458 / pathfinder 62.803 / ucb 57.486 / boundary 35.219 |
| holdout/60 | ring | 60 | 0 | strongest | strongest 115.770 / ucb 52.399 / pathfinder 37.049 / boundary 33.851 |
| holdout/61 | ring | 60 | 1 | strongest | strongest 68.896 / pathfinder 61.774 / boundary 33.250 / ucb 30.542 |
| holdout/62 | ring | 60 | 2 | strongest | strongest 83.298 / ucb 54.539 / boundary 31.262 / pathfinder 16.836 |
| holdout/63 | ring | 60 | 3 | strongest | strongest 91.366 / pathfinder 66.093 / ucb 51.312 / boundary 27.862 |
| holdout/64 | plain | 60 | 0 | ucb | ucb 81.089 / strongest 79.266 / boundary 54.917 / pathfinder 17.134 |
| holdout/65 | plain | 60 | 1 | strongest | strongest 77.242 / ucb 73.178 / pathfinder 35.825 / boundary 32.848 |
| holdout/66 | plain | 60 | 2 | strongest | strongest 95.226 / pathfinder 49.650 / ucb 32.510 / boundary 26.013 |
| holdout/67 | plain | 60 | 3 | strongest | strongest 70.908 / ucb 36.295 / boundary 30.130 / pathfinder 29.113 |
| holdout/68 | basin | 60 | 0 | strongest | strongest 66.315 / ucb 66.176 / boundary 54.899 / pathfinder 17.097 |
| holdout/69 | basin | 60 | 1 | ucb | ucb 71.317 / strongest 66.470 / pathfinder 35.178 / boundary 29.704 |
| holdout/70 | basin | 60 | 2 | strongest | strongest 74.872 / pathfinder 51.787 / ucb 31.928 / boundary 23.683 |
| holdout/71 | basin | 60 | 3 | strongest | strongest 57.201 / ucb 39.477 / boundary 30.130 / pathfinder 29.123 |
| holdout/72 | canyon | 60 | 0 | strongest | strongest 67.393 / ucb 63.371 / boundary 41.335 / pathfinder 37.074 |
| holdout/73 | canyon | 60 | 1 | strongest | strongest 106.842 / pathfinder 46.746 / ucb 38.565 / boundary 33.342 |
| holdout/74 | canyon | 60 | 2 | strongest | strongest 106.679 / pathfinder 47.314 / boundary 37.967 / ucb 35.011 |
| holdout/75 | canyon | 60 | 3 | strongest | strongest 93.588 / ucb 49.420 / boundary 34.904 / pathfinder 32.300 |
| holdout/76 | ring | 60 | 0 | ucb | ucb 71.307 / strongest 69.792 / boundary 56.670 / pathfinder 17.660 |
| holdout/77 | ring | 60 | 1 | strongest | strongest 81.687 / ucb 74.964 / pathfinder 35.830 / boundary 33.350 |
| holdout/78 | ring | 60 | 2 | strongest | strongest 90.093 / pathfinder 49.976 / ucb 33.558 / boundary 22.459 |
| holdout/79 | ring | 60 | 3 | strongest | strongest 89.176 / ucb 46.679 / pathfinder 31.820 / boundary 31.053 |
| holdout/80 | plain | 60 | 0 | strongest | strongest 124.796 / ucb 35.106 / pathfinder 31.449 / boundary 27.216 |
| holdout/81 | plain | 60 | 1 | strongest | strongest 140.418 / ucb 39.580 / boundary 33.219 / pathfinder 26.513 |
| holdout/82 | plain | 60 | 2 | strongest | strongest 101.681 / ucb 53.428 / pathfinder 29.964 / boundary 23.481 |
| holdout/83 | plain | 60 | 3 | strongest | strongest 112.137 / ucb 57.785 / pathfinder 35.291 / boundary 28.630 |
| holdout/84 | basin | 60 | 0 | strongest | strongest 63.988 / ucb 58.317 / boundary 27.052 / pathfinder 21.416 |
| holdout/85 | basin | 60 | 1 | pathfinder | pathfinder 46.651 / strongest 45.854 / boundary 33.219 / ucb 23.590 |
| holdout/86 | basin | 60 | 2 | ucb | ucb 66.032 / strongest 53.508 / boundary 23.586 / pathfinder 17.046 |
| holdout/87 | basin | 60 | 3 | ucb | ucb 70.158 / strongest 68.005 / pathfinder 40.685 / boundary 27.540 |
| holdout/88 | canyon | 60 | 0 | strongest | strongest 72.154 / pathfinder 60.317 / ucb 49.320 / boundary 42.159 |
| holdout/89 | canyon | 60 | 1 | strongest | strongest 89.204 / ucb 48.950 / boundary 46.657 / pathfinder 44.903 |
| holdout/90 | canyon | 60 | 2 | strongest | strongest 98.129 / ucb 45.894 / pathfinder 43.766 / boundary 36.148 |
| holdout/91 | canyon | 60 | 3 | strongest | strongest 106.644 / ucb 49.247 / pathfinder 47.196 / boundary 35.292 |
| holdout/92 | ring | 60 | 0 | strongest | strongest 108.280 / pathfinder 50.484 / ucb 36.315 / boundary 36.176 |
| holdout/93 | ring | 60 | 1 | strongest | strongest 129.160 / pathfinder 51.801 / boundary 41.643 / ucb 40.994 |
| holdout/94 | ring | 60 | 2 | strongest | strongest 105.509 / pathfinder 44.193 / ucb 38.432 / boundary 31.211 |
| holdout/95 | ring | 60 | 3 | strongest | strongest 126.050 / ucb 44.706 / pathfinder 41.284 / boundary 31.460 |
| holdout/96 | plain | 60 | 0 | ucb | ucb 75.743 / strongest 70.252 / boundary 34.990 / pathfinder 29.967 |
| holdout/97 | plain | 60 | 1 | strongest | strongest 97.522 / ucb 58.335 / pathfinder 53.847 / boundary 35.815 |
| holdout/98 | plain | 60 | 2 | strongest | strongest 106.015 / pathfinder 57.405 / ucb 41.827 / boundary 31.427 |
| holdout/99 | plain | 60 | 3 | strongest | strongest 115.959 / ucb 55.197 / pathfinder 41.991 / boundary 30.542 |
| holdout/100 | basin | 60 | 0 | ucb | ucb 81.052 / strongest 47.096 / boundary 34.480 / pathfinder 33.860 |
| holdout/101 | basin | 60 | 1 | pathfinder | pathfinder 87.267 / strongest 41.088 / boundary 33.839 / ucb 28.767 |
| holdout/102 | basin | 60 | 2 | ucb | ucb 78.907 / strongest 39.452 / boundary 34.393 / pathfinder 27.890 |
| holdout/103 | basin | 60 | 3 | strongest | strongest 74.585 / ucb 67.861 / pathfinder 52.058 / boundary 30.580 |
| holdout/104 | canyon | 60 | 0 | strongest | strongest 89.975 / pathfinder 61.530 / ucb 54.626 / boundary 29.884 |
| holdout/105 | canyon | 60 | 1 | strongest | strongest 95.090 / pathfinder 53.222 / ucb 51.141 / boundary 36.622 |
| holdout/106 | canyon | 60 | 2 | strongest | strongest 81.842 / ucb 56.912 / pathfinder 56.893 / boundary 33.638 |
| holdout/107 | canyon | 60 | 3 | strongest | strongest 82.316 / pathfinder 71.863 / boundary 40.055 / ucb 36.086 |
| holdout/108 | ring | 60 | 0 | ucb | ucb 72.307 / strongest 66.663 / boundary 36.665 / pathfinder 30.094 |
| holdout/109 | ring | 60 | 1 | strongest | strongest 92.779 / ucb 57.177 / pathfinder 53.981 / boundary 34.952 |
| holdout/110 | ring | 60 | 2 | strongest | strongest 126.211 / ucb 42.538 / pathfinder 40.136 / boundary 35.859 |
| holdout/111 | ring | 60 | 3 | strongest | strongest 114.876 / ucb 46.097 / pathfinder 43.571 / boundary 32.143 |
| holdout/112 | plain | 60 | 0 | ucb | ucb 77.660 / strongest 72.705 / boundary 30.528 / pathfinder 28.859 |
| holdout/113 | plain | 60 | 1 | strongest | strongest 104.152 / ucb 65.817 / pathfinder 40.886 / boundary 33.583 |
| holdout/114 | plain | 60 | 2 | strongest | strongest 115.459 / pathfinder 61.700 / ucb 48.619 / boundary 23.516 |
| holdout/115 | plain | 60 | 3 | strongest | strongest 81.345 / pathfinder 45.958 / ucb 40.011 / boundary 31.496 |
| holdout/116 | basin | 60 | 0 | ucb | ucb 71.452 / strongest 60.197 / pathfinder 31.496 / boundary 26.631 |
| holdout/117 | basin | 60 | 1 | pathfinder | pathfinder 71.504 / strongest 60.090 / boundary 33.576 / ucb 32.196 |
| holdout/118 | basin | 60 | 2 | strongest | strongest 84.241 / pathfinder 63.062 / ucb 50.574 / boundary 25.447 |
| holdout/119 | basin | 60 | 3 | pathfinder | pathfinder 80.803 / strongest 66.817 / ucb 33.153 / boundary 31.501 |
| holdout/120 | canyon | 60 | 0 | strongest | strongest 78.067 / ucb 71.459 / boundary 50.547 / pathfinder 43.102 |
| holdout/121 | canyon | 60 | 1 | strongest | strongest 93.362 / pathfinder 64.352 / boundary 50.445 / ucb 48.750 |
| holdout/122 | canyon | 60 | 2 | strongest | strongest 99.926 / pathfinder 61.547 / ucb 47.402 / boundary 29.353 |
| holdout/123 | canyon | 60 | 3 | strongest | strongest 100.672 / pathfinder 55.607 / ucb 46.530 / boundary 29.351 |
| holdout/124 | ring | 60 | 0 | strongest | strongest 103.551 / pathfinder 57.318 / ucb 42.219 / boundary 31.297 |
| holdout/125 | ring | 60 | 1 | strongest | strongest 72.780 / pathfinder 66.403 / ucb 38.422 / boundary 35.398 |
| holdout/126 | ring | 60 | 2 | strongest | strongest 88.825 / ucb 57.561 / boundary 23.075 / pathfinder 16.077 |
| holdout/127 | ring | 60 | 3 | strongest | strongest 92.224 / ucb 80.670 / boundary 33.215 / pathfinder 30.273 |
| long/128 | plain | 180 | 0 | ucb | ucb 383.040 / boundary 306.023 / strongest 283.435 / pathfinder 37.254 |
| long/129 | plain | 180 | 1 | ucb | ucb 300.126 / strongest 255.267 / boundary 238.043 / pathfinder 162.869 |
| long/130 | plain | 180 | 2 | strongest | strongest 362.175 / boundary 206.430 / ucb 206.278 / pathfinder 188.599 |
| long/131 | plain | 180 | 3 | strongest | strongest 503.749 / boundary 176.907 / ucb 162.317 / pathfinder 93.526 |
| long/132 | plain | 400 | 0 | boundary | boundary 1244.206 / ucb 923.094 / strongest 831.400 / pathfinder 126.885 |
| long/133 | plain | 400 | 1 | boundary | boundary 1383.420 / ucb 777.958 / strongest 685.310 / pathfinder 152.831 |
| long/134 | plain | 400 | 2 | boundary | boundary 1038.251 / strongest 888.397 / ucb 764.527 / pathfinder 94.113 |
| long/135 | plain | 400 | 3 | strongest | strongest 1283.385 / ucb 959.156 / boundary 710.091 / pathfinder 70.271 |
| duel/136 | plain | 60 | 0 | strongest | strongest 88.879 / pathfinder 64.689 |
| duel/137 | plain | 60 | 0 | strongest | strongest 80.530 / pathfinder 58.371 |
| duel/138 | plain | 60 | 0 | strongest | strongest 70.422 / pathfinder 46.307 |
| duel/139 | plain | 60 | 0 | strongest | strongest 117.455 / pathfinder 55.264 |
| duel/140 | plain | 60 | 0 | strongest | strongest 125.771 / boundary 28.253 |
| duel/141 | plain | 60 | 0 | strongest | strongest 121.628 / boundary 26.008 |
| duel/142 | plain | 60 | 0 | strongest | strongest 134.671 / boundary 39.156 |
| duel/143 | plain | 60 | 0 | strongest | strongest 106.754 / boundary 37.018 |
| duel/144 | plain | 60 | 0 | strongest | strongest 92.966 / ucb 23.397 |
| duel/145 | plain | 60 | 0 | strongest | strongest 97.767 / ucb 27.155 |
| duel/146 | plain | 60 | 0 | strongest | strongest 108.923 / ucb 47.085 |
| duel/147 | plain | 60 | 0 | strongest | strongest 87.339 / ucb 37.176 |

## 执行错误

无。
