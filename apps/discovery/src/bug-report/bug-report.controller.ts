import { DeviceBugReportTopics } from "@app/common/microservice-client/topics";
import { Controller, Logger } from "@nestjs/common";
import { BugReportService } from "./bug-report.service";
import { MessagePattern, Payload } from "@nestjs/microservices";
import { NewBugReportDto } from "@app/common/dto/bug-report";


@Controller()
export class BugReportController{

  constructor(private readonly bugReportService: BugReportService) {}

  @MessagePattern(DeviceBugReportTopics.NEW_BUG_REPORT)
  newBugReport(@Payload() bugReport: NewBugReportDto){
    return this.bugReportService.newBugReport(bugReport)
  }

  @MessagePattern(DeviceBugReportTopics.GET_BUG_REPORT)
  getBugReport(@Payload("stringValue") bugId: string){
    return this.bugReportService.getBugReport(bugId)
  }

}