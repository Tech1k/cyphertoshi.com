// Build a scalable SVG from a qrcode.js matrix, optionally embedding a vector coin logo.
// qrToSVG(qr, coinKey) -> string ; downloadSVGString(svg, filename). No dependencies.
var coinSVG = {
    monero: {
        vb: '0 0 3756.09 3756.49',
        inner: '<path d="M4128,2249.81C4128,3287,3287.26,4127.86,2250,4127.86S372,3287,372,2249.81,1212.76,371.75,2250,371.75,4128,1212.54,4128,2249.81Z" transform="translate(-371.96 -371.75)" style="fill:#fff"/><path d="M2250,371.75c-1036.89,0-1879.12,842.06-1877.8,1878,0.26,207.26,33.31,406.63,95.34,593.12h561.88V1263L2250,2483.57,3470.52,1263v1579.9h562c62.12-186.48,95-385.85,95.37-593.12C4129.66,1212.76,3287,372,2250,372Z" transform="translate(-371.96 -371.75)" style="fill:#f26822"/><path d="M1969.3,2764.17l-532.67-532.7v994.14H1029.38l-384.29.07c329.63,540.8,925.35,902.56,1604.91,902.56S3525.31,3766.4,3855,3225.6H3063.25V2231.47l-532.7,532.7-280.61,280.61-280.62-280.61h0Z" transform="translate(-371.96 -371.75)" style="fill:#4d4d4d"/>'
    },
    bitcoin: {
        vb: '0 0 4091.27 4091.73',
        inner: '<path fill="#F7931A" fill-rule="nonzero" d="M4030.06 2540.77c-273.24,1096.01 -1383.32,1763.02 -2479.46,1489.71 -1095.68,-273.24 -1762.69,-1383.39 -1489.33,-2479.31 273.12,-1096.13 1383.2,-1763.19 2479,-1489.95 1096.06,273.24 1763.03,1383.51 1489.76,2479.57l0.02 -0.02z"/><path fill="white" fill-rule="nonzero" d="M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95 -368.8 -224.5 -55.94 -89.51 359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16 -361.46 -224.36 -55.94 -92 368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26 -1.16 -309.59 -77.31 -59.72 239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74 420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81 588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46 256.98 292.15 72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9 373.03 224.24 55.94 92 -369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69 367.33 224.51 55.94 92.89 -372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07 -0.05zm-512.93 719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28 -494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43 -723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77 -448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02 0z"/>'
    },
    litecoin: {
        vb: '0 0 82.6 82.6',
        inner: '<circle cx="41.3" cy="41.3" r="36.83" style="fill:#fff"/><path d="M41.3,0A41.3,41.3,0,1,0,82.6,41.3h0A41.18,41.18,0,0,0,41.54,0ZM42,42.7,37.7,57.2h23a1.16,1.16,0,0,1,1.2,1.12v.38l-2,6.9a1.49,1.49,0,0,1-1.5,1.1H23.2l5.9-20.1-6.6,2L24,44l6.6-2,8.3-28.2a1.51,1.51,0,0,1,1.5-1.1h8.9a1.16,1.16,0,0,1,1.2,1.12v.38L43.5,38l6.6-2-1.4,4.8Z" style="fill:#345d9d"/>'
    }
};

function qrToSVG(qr, coinKey, customHref) {
    var count = qr.getModuleCount(), margin = 4, dim = count + margin * 2;
    var d = '';
    for (var r = 0; r < count; r++)
        for (var c = 0; c < count; c++)
            if (qr.isDark(r, c)) d += 'M' + (c + margin) + ' ' + (r + margin) + 'h1v1h-1z';
    var sz = Math.round(dim * 0.26 * 1000) / 1000;
    var pos = Math.round((dim - sz) / 2 * 1000) / 1000;
    var logo = '';
    if (customHref) {
        logo = '<image x="' + pos + '" y="' + pos + '" width="' + sz + '" height="' + sz + '" preserveAspectRatio="xMidYMid meet" xlink:href="' + customHref + '"/>';
    } else {
        var coin = coinKey && coinSVG[coinKey];
        if (coin) logo = '<svg x="' + pos + '" y="' + pos + '" width="' + sz + '" height="' + sz + '" viewBox="' + coin.vb + '">' + coin.inner + '</svg>';
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + dim + ' ' + dim + '">' +
        '<rect width="' + dim + '" height="' + dim + '" fill="#ffffff"/>' +
        '<path fill="#000000" shape-rendering="crispEdges" d="' + d + '"/>' + logo +
        '</svg>';
}

function downloadSVGString(svg, filename) {
    var blob = new Blob([svg], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
