import { DeviceBugReportTopics } from "@app/common/microservice-client/topics";
import { Controller } from "@nestjs/common";
import { BugReportService } from "./bug-report.service";
import { MessagePattern } from "@nestjs/microservices";
import { NewBugReportDto } from "@app/common/dto/bug-report";
import { RpcPayload } from "@app/common/microservice-client";


@Controller()
export class BugReportController{

  constructor(private readonly bugReportService: BugReportService) {}

  @MessagePattern(DeviceBugReportTopics.NEW_BUG_REPORT)
  newBugReport(@RpcPayload() bugReport: NewBugReportDto){
    return this.bugReportService.newBugReport(bugReport)
  }

  @MessagePattern(DeviceBugReportTopics.GET_BUG_REPORT)
  getBugReport(@RpcPayload("stringValue") bugId: string){
    return this.bugReportService.getBugReport(bugId)
  }

}