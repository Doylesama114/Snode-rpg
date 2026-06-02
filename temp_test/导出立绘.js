// 导出立绘.js — OOXML standard drawing portrait injector
// Called by the export engine in 角色面板.html / 角色创建页.html / 上传角色.html
// Usage: var ok = injectPortrait(state, entries);

function injectPortrait(state, entries) {
  if (!state || !state.portrait) return false;
  if (state.portrait.indexOf("data:image/") !== 0) return false;

  try {
    // Decode portrait from data URL
    var parts = state.portrait.split(",");
    var head = parts[0];
    var b64 = parts.length > 1 ? parts[1] : "";
    var bin = atob(b64);
    var imgData = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) imgData[i] = bin.charCodeAt(i);

    // Detect format
    var ext = "png";
    var mime = "image/png";
    if (head.indexOf("jpeg") >= 0 || head.indexOf("jpg") >= 0) { ext = "jpg"; mime = "image/jpeg"; }
    else if (head.indexOf("gif") >= 0) { ext = "gif"; mime = "image/gif"; }
    else if (head.indexOf("webp") >= 0) { ext = "webp"; mime = "image/webp"; }

    // Push image file
    entries.push({ name: "xl/media/image1." + ext, method: 0, text: "", rawData: imgData, compSize: imgData.length, uncompSize: imgData.length });

    // OOXML drawing1.xml — anchor at G3:I12
    var drXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
      '<xdr:twoCellAnchor editAs="oneCell">' +
      '<xdr:from><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>2</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>' +
      '<xdr:to><xdr:col>8</xdr:col><xdr:colOff>500000</xdr:colOff><xdr:row>11</xdr:row><xdr:rowOff>500000</xdr:rowOff></xdr:to>' +
      '<xdr:pic>' +
      '<xdr:nvPicPr><xdr:cNvPr id="2" name="portrait"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>' +
      '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>' +
      '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>' +
      '</xdr:pic><xdr:clientData/>' +
      '</xdr:twoCellAnchor>' +
      '</xdr:wsDr>';
    var drBuf = new TextEncoder().encode(drXml);
    entries.push({ name: "xl/drawings/drawing1.xml", method: 0, text: drXml, rawData: drBuf, compSize: drBuf.length, uncompSize: drBuf.length });

    // Drawing -> image rels
    var drRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.' + ext + '"/>' +
      '</Relationships>';
    var drRelsBuf = new TextEncoder().encode(drRels);
    entries.push({ name: "xl/drawings/_rels/drawing1.xml.rels", method: 0, text: drRels, rawData: drRelsBuf, compSize: drRelsBuf.length, uncompSize: drRelsBuf.length });

    // Sheet -> drawing rels
    var shRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' +
      '</Relationships>';
    var shRelsBuf = new TextEncoder().encode(shRels);
    entries.push({ name: "xl/worksheets/_rels/sheet1.xml.rels", method: 0, text: shRels, rawData: shRelsBuf, compSize: shRelsBuf.length, uncompSize: shRelsBuf.length });

    // Inject <drawing> into sheet1.xml
    var sh = null;
    for (var ei = 0; ei < entries.length; ei++) {
      if (entries[ei].name === "xl/worksheets/sheet1.xml") { sh = entries[ei]; break; }
    }
    if (sh && sh.text.indexOf("<drawing") < 0) {
      sh.text = sh.text.replace("</worksheet>", '<drawing r:id="rId1"/></worksheet>');
      var shBuf2 = new TextEncoder().encode(sh.text);
      sh.rawData = shBuf2; sh.compSize = shBuf2.length; sh.uncompSize = shBuf2.length; sh.method = 0;
    }

    // Fix Content_Types
    var ct = null;
    for (var ei = 0; ei < entries.length; ei++) {
      if (entries[ei].name === "[Content_Types].xml") { ct = entries[ei]; break; }
    }
    if (ct) {
      var extReg = 'Extension="' + ext + '"';
      if (ct.text.indexOf(extReg) < 0) {
        ct.text = ct.text.replace("<Types", '<Types><Default Extension="' + ext + '" ContentType="' + mime + '"/>');
      }
      if (ct.text.indexOf("/xl/drawings") < 0) {
        ct.text = ct.text.replace("</Types>", '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');
      }
      var ctBuf = new TextEncoder().encode(ct.text);
      ct.rawData = ctBuf; ct.compSize = ctBuf.length; ct.uncompSize = ctBuf.length; ct.method = 0;
    }

    return true;
  } catch (e) {
    console.log("Portrait export error:", e);
    return false;
  }
}
