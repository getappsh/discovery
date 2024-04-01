// import { Injectable, Logger } from "@nestjs/common";
// import {PythonShell} from 'python-shell';
// import { Tile } from "./dto/tile.dto";
// import { BBox } from "./dto/box.dto";
// import { validateOrReject } from "class-validator";
// import { plainToInstance } from "class-transformer";


// @Injectable()
// export class TileMatrixService {

//   private readonly logger = new Logger(TileMatrixService.name);
//   private pythonPath: string;

//   constructor(){
//     let isWin = process.platform === "win32";
//     this.pythonPath = isWin? 'python': 'python3'

//   }


//   async getTiles(box: {left: number, bottom: number, right: number, top: number, size: number}): Promise<{tile: Tile; bbox: BBox;}[]> {
//     const options = {
//       pythonPath: this.pythonPath, 
//       scriptPath: './python',
//       args: [
//         box.left.toString(), 
//         box.bottom.toString(), 
//         box.right.toString(), 
//         box.top.toString(), 
//         box.size.toString()
//       ], 
//     };
    

//     let tileMatrix: any[][] = JSON.parse((await PythonShell.run("inspire_tile.py", options))[0])

//     const tileMapList = tileMatrix.map((item) => {
//       const tile: Tile = { x: item[0][0], y: item[0][1], zoom: item[0][2] };
//       const bbox: BBox = {
//         left: item[1][0],
//         bottom: item[1][1],
//         right: item[1][2],
//         top: item[1][3],
//       };
//       return { tile, bbox };
//     });
  

//     this.logger.debug(`TileMapList: ${JSON.stringify(tileMapList)}`);
//     this.validate(tileMapList);
//     return tileMapList
//   }

//   async validate(tileMapList: {tile: Tile; bbox: BBox;}[]){
//     for (let value of tileMapList){
//       const mapToValidate = plainToInstance(BBox, value.bbox);
//       await validateOrReject(mapToValidate)
  
//       const tileToValidate = plainToInstance(Tile, value.tile);
//       await validateOrReject(tileToValidate)
      
//     }
  
//   }

  
// }