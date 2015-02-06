/* lutanalyst.js
* LA LUT calculation object for the LUTCalc Web App.
* 31st December 2014
*
* LUTCalc generates 1D and 3D Lookup Tables (LUTs) for video cameras that shoot log gammas, 
* principally the Sony CineAlta line.
*
* By Ben Turley, http://turley.tv
* First License: GPLv2
* Github: https://github.com/cameramanben/LUTCalc
*/
function LUTAnalyst(inputs, message) {
	this.inputs = inputs;
	this.message = message;
	this.p = 7;
	this.message.addUI(this.p,this);
	this.lutRange();
	this.title = 'LUT Analyst';
	this.inLUT = new LUTs();
	this.tf = new LUTs();
	this.cs = new LUTs();
}
LUTAnalyst.prototype.setLUT = function(lut) {
	switch(lut.dest) {
		case 'in':	this.inLUT.setDetails(lut);
					this.title = lut.title;
					break;
		case 'tf':	this.tf.setDetails(lut);
					this.title = lut.title;
					break;
		case 'cs':	this.cs.setDetails(lut);
					break;
	}
}
LUTAnalyst.prototype.getTitle = function() {
	return this.title;
}
LUTAnalyst.prototype.reset = function() {
	this.title = 'LUT Analyst';
	this.inLUT = new LUTs();
	this.tf = new LUTs();
	this.cs = new LUTs();
}
LUTAnalyst.prototype.lutRange = function() {
	if (this.inputs.laRange[3].checked || this.inputs.laRange[2].checked) {
		this.legIn = true;
	} else {
		this.legIn = false;
	}
	if (this.inputs.laRange[0].checked || this.inputs.laRange[2].checked) {
		this.legOut = true;
	} else {
		this.legOut = false;
	}
}
LUTAnalyst.prototype.is1D = function() {
	return this.inLUT.is1D();
}
LUTAnalyst.prototype.is3D = function() {
	return this.inLUT.is3D();
}
LUTAnalyst.prototype.getTF = function() {
	this.lutRange();
	this.pass = 0;
	this.gammaIn = parseInt(this.inputs.laGammaSelect.options[this.inputs.laGammaSelect.selectedIndex].value);
	if (this.gammaIn === 9999) {
		this.gammaIn = parseInt(this.inputs.laLinGammaSelect.options[this.inputs.laLinGammaSelect.selectedIndex].value);
	}
	var dim = this.inLUT.getSize();
	if (dim < 256) {
		dim = 256;
	}
	this.message.gaTx(this.p,8,{
		dim: dim,
		legIn: this.legIn,
		gamma: this.gammaIn
	});
}
LUTAnalyst.prototype.getCS = function() {
	this.gamutIn = parseInt(this.inputs.laGamutSelect.options[this.inputs.laGamutSelect.selectedIndex].value);
	this.message.gaTx(this.p,2,{
		dim: 33,
		legIn: this.legIn,
		gamma: this.gammaIn,
		gamut: this.gamutIn
	});
}
LUTAnalyst.prototype.gotInputVals = function(values,dim) {
	var vals = new Float64Array(values);
	if (this.pass === 0) { // Transfer function pass
		var max = vals.length;
		var C = new Float64Array(max);
		for (var j=0; j<max; j++) {
			var L = vals[j];
			C[j] = this.inLUT.lumaLCub(L);
			if (this.legOut) {
				C[j] = ((C[j]*876)+64)/1023;
			}
		}
		this.tf.setDetails({
			title: 'Transfer Function',
			format: 'cube',
			dims: 1,
			s: max,
			min: [0,0,0],
			max: [1,1,1],
			C: [C.buffer,C.buffer,C.buffer]
		});
		this.pass = 1;
		this.getCS();
	} else { // Colour Space Pass
		this.brent = new Brent(this.tf,0,1);
		var max = dim*dim*dim;
		var R = new Float64Array(max);
		var G = new Float64Array(max);
		var B = new Float64Array(max);
		for (var j=0; j<max; j++) {
			var rgb = this.inLUT.rgbRGBCub([
									vals[j*3],
									vals[(j*3)+1],
									vals[(j*3)+2]
								]);
			if (this.legOut) {
				rgb[0] = ((rgb[0]*876)+64)/1023;
				rgb[1] = ((rgb[1]*876)+64)/1023;
				rgb[2] = ((rgb[2]*876)+64)/1023;
			}
			R[j] = this.revTF((j%dim) / (dim-1)				, rgb[0]);
			G[j] = this.revTF(((j/dim)%dim) / (max-1)		, rgb[1]);
			B[j] = this.revTF(((j/(dim*dim))%dim) / (max-1)	, rgb[2]);
		}
		this.cs.setDetails({
			title: 'Colour Space',
			format: 'cube',
			dims: 3,
			s: dim,
			min: [0,0,0],
			max: [1,1,1],
			C: [R.buffer,G.buffer,B.buffer]
		});
		this.updateLATF();
		this.updateLACS();
	}
}
LUTAnalyst.prototype.revTF = function(guess,goal) { // Brent Method
	return this.brent.findRoot(guess,goal);
}
LUTAnalyst.prototype.updateLATF = function() {
	this.gaT = this.message.getGammaThreads();
	this.message.gaTxAll(this.p,6,this.tf.getDetails());
}
LUTAnalyst.prototype.updateLACS = function() {
	this.gtT = this.message.getGamutThreads();
	this.message.gtTxAll(this.p,6,this.cs.getDetails());
}