/**
 * Migration Reporter
 * Provides progress tracking and reporting for storage migration operations.
 * Generates detailed reports, progress updates, and performance metrics.
 */

import * as fs from 'fs';
import * as path from 'path';
import { injectable } from 'inversify';
import type {
  MigrationResult,
  MigrationProgress,
  CandleFileInfo,
  ValidationSummary,
} from './StorageMigrator.js';
import type { ValidationReport } from './MigrationValidator.js';

export interface ReportConfig {
  /** Output directory for reports */
  outputDir: string;

  /** Report format */
  format: 'json' | 'html' | 'markdown' | 'csv';

  /** Include detailed file information */
  includeFileDetails?: boolean;

  /** Include performance charts (HTML format only) */
  includeCharts?: boolean;

  /** Include validation details */
  includeValidation?: boolean;

  /** Report template (for custom formatting) */
  template?: string;
}

export interface ProgressCallback {
  (progress: MigrationProgress): void;
}

export interface ReportData {
  /** Report metadata */
  metadata: {
    generatedAt: number;
    version: string;
    reportType: 'migration' | 'validation' | 'combined';
  };

  /** Migration results */
  migration?: MigrationResult;

  /** Validation results */
  validation?: ValidationReport;

  /** Executive summary */
  summary: ExecutiveSummary;

  /** Detailed sections */
  sections: ReportSection[];
}

export interface ExecutiveSummary {
  /** Overall status */
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';

  /** Key metrics */
  metrics: {
    totalFiles: number;
    totalCandles: number;
    successRate: number;
    duration: string;
    performance: string;
  };

  /** Key findings */
  findings: string[];

  /** Recommendations */
  recommendations: string[];
}

export interface ReportSection {
  /** Section title */
  title: string;

  /** Section type */
  type:
    | 'overview'
    | 'performance'
    | 'errors'
    | 'files'
    | 'validation'
    | 'recommendations';

  /** Section content */
  content: any;

  /** Charts or visualizations */
  charts?: ChartData[];
}

export interface ChartData {
  /** Chart type */
  type: 'line' | 'bar' | 'pie' | 'timeline';

  /** Chart title */
  title: string;

  /** Chart data */
  data: any;

  /** Chart configuration */
  config?: any;
}

/**
 * Migration Reporter
 * Generates comprehensive reports for migration operations including progress tracking,
 * performance analysis, error reporting, and validation results.
 */
@injectable()
export class MigrationReporter {
  private progressCallbacks: ProgressCallback[] = [];
  private reportHistory: string[] = [];

  /**
   * Register progress callback
   */
  onProgress(callback: ProgressCallback): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Report progress update
   */
  reportProgress(progress: MigrationProgress): void {
    // Update estimated completion time
    if (progress.totalCandles > 0 && progress.migratedCandles > 0) {
      const elapsed = Date.now() - progress.startTime;
      const rate = progress.migratedCandles / elapsed;
      const remaining = progress.totalCandles - progress.migratedCandles;
      progress.estimatedCompletion = Date.now() + remaining / rate;
    }

    // Notify callbacks
    for (const callback of this.progressCallbacks) {
      try {
        callback(progress);
      } catch (error) {
        console.warn('Progress callback error:', error);
      }
    }

    // Log progress
    this.logProgress(progress);
  }

  /**
   * Generate migration report
   */
  async generateMigrationReport(
    result: MigrationResult,
    config: ReportConfig
  ): Promise<string> {
    const reportData: ReportData = {
      metadata: {
        generatedAt: Date.now(),
        version: '1.0.0',
        reportType: 'migration',
      },
      migration: result,
      summary: this.generateExecutiveSummary(result),
      sections: this.generateMigrationSections(result),
    };

    return this.generateReport(reportData, config);
  }

  /**
   * Generate validation report
   */
  async generateValidationReport(
    validation: ValidationReport,
    config: ReportConfig
  ): Promise<string> {
    const reportData: ReportData = {
      metadata: {
        generatedAt: Date.now(),
        version: '1.0.0',
        reportType: 'validation',
      },
      validation,
      summary: this.generateValidationSummary(validation),
      sections: this.generateValidationSections(validation),
    };

    return this.generateReport(reportData, config);
  }

  /**
   * Generate combined migration and validation report
   */
  async generateCombinedReport(
    migration: MigrationResult,
    validation: ValidationReport,
    config: ReportConfig
  ): Promise<string> {
    const reportData: ReportData = {
      metadata: {
        generatedAt: Date.now(),
        version: '1.0.0',
        reportType: 'combined',
      },
      migration,
      validation,
      summary: this.generateCombinedSummary(migration, validation),
      sections: [
        ...this.generateMigrationSections(migration),
        ...this.generateValidationSections(validation),
      ],
    };

    return this.generateReport(reportData, config);
  }

  /**
   * Generate report in specified format
   */
  private async generateReport(
    data: ReportData,
    config: ReportConfig
  ): Promise<string> {
    // Ensure output directory exists
    if (!fs.existsSync(config.outputDir)) {
      fs.mkdirSync(config.outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${data.metadata.reportType}-report-${timestamp}`;

    let reportPath: string;
    let content: string;

    switch (config.format) {
      case 'json':
        reportPath = path.join(config.outputDir, `${fileName}.json`);
        content = JSON.stringify(data, null, 2);
        break;

      case 'html':
        reportPath = path.join(config.outputDir, `${fileName}.html`);
        content = this.generateHtmlReport(data, config);
        break;

      case 'markdown':
        reportPath = path.join(config.outputDir, `${fileName}.md`);
        content = this.generateMarkdownReport(data, config);
        break;

      case 'csv':
        reportPath = path.join(config.outputDir, `${fileName}.csv`);
        content = this.generateCsvReport(data, config);
        break;

      default:
        throw new Error(`Unsupported report format: ${config.format}`);
    }

    fs.writeFileSync(reportPath, content);
    this.reportHistory.push(reportPath);

    console.log(`Report generated: ${reportPath}`);
    return reportPath;
  }

  /**
   * Generate executive summary for migration
   */
  private generateExecutiveSummary(result: MigrationResult): ExecutiveSummary {
    const status = result.success
      ? 'SUCCESS'
      : result.failedFiles.length < result.migratedFiles.length
      ? 'PARTIAL'
      : 'FAILED';

    const successRate =
      result.progress.totalFiles > 0
        ? result.migratedFiles.length / result.progress.totalFiles
        : 0;

    const duration = this.formatDuration(result.duration);
    const performance = `${result.performance.candlesPerSecond.toFixed(
      0
    )} candles/sec`;

    const findings: string[] = [];
    if (result.success) {
      findings.push('Migration completed successfully');
    } else {
      findings.push(`${result.failedFiles.length} files failed to migrate`);
    }

    if (result.validationResults.errorCount > 0) {
      findings.push(
        `${result.validationResults.errorCount} validation errors detected`
      );
    }

    if (result.progress.warnings.length > 0) {
      findings.push(`${result.progress.warnings.length} warnings encountered`);
    }

    const recommendations: string[] = [];
    if (!result.success) {
      recommendations.push('Review failed files and retry migration');
    }
    if (result.validationResults.successRate < 0.95) {
      recommendations.push('Investigate validation errors before proceeding');
    }
    if (result.performance.candlesPerSecond < 1000) {
      recommendations.push(
        'Consider optimizing batch size for better performance'
      );
    }

    return {
      status,
      metrics: {
        totalFiles: result.progress.totalFiles,
        totalCandles: result.progress.totalCandles,
        successRate,
        duration,
        performance,
      },
      findings,
      recommendations,
    };
  }

  /**
   * Generate executive summary for validation
   */
  private generateValidationSummary(
    validation: ValidationReport
  ): ExecutiveSummary {
    const status =
      validation.summary.totalErrors === 0
        ? 'SUCCESS'
        : validation.summary.successRate > 0.9
        ? 'PARTIAL'
        : 'FAILED';

    const duration = this.formatDuration(validation.summary.durationMs);
    const performance = `${validation.summary.performance.candlesPerSecond.toFixed(
      0
    )} candles/sec`;

    const findings: string[] = [];
    if (validation.summary.totalErrors === 0) {
      findings.push('All validation checks passed');
    } else {
      findings.push(
        `${validation.summary.totalErrors} validation errors found`
      );
    }

    if (validation.summary.totalWarnings > 0) {
      findings.push(`${validation.summary.totalWarnings} warnings detected`);
    }

    return {
      status,
      metrics: {
        totalFiles: validation.summary.totalFiles,
        totalCandles: validation.summary.totalCandles,
        successRate: validation.summary.successRate,
        duration,
        performance,
      },
      findings,
      recommendations: validation.recommendations,
    };
  }

  /**
   * Generate combined summary
   */
  private generateCombinedSummary(
    migration: MigrationResult,
    validation: ValidationReport
  ): ExecutiveSummary {
    const migrationSummary = this.generateExecutiveSummary(migration);
    const validationSummary = this.generateValidationSummary(validation);

    const status =
      migrationSummary.status === 'SUCCESS' &&
      validationSummary.status === 'SUCCESS'
        ? 'SUCCESS'
        : 'PARTIAL';

    return {
      status,
      metrics: migrationSummary.metrics,
      findings: [...migrationSummary.findings, ...validationSummary.findings],
      recommendations: [
        ...migrationSummary.recommendations,
        ...validationSummary.recommendations,
      ],
    };
  }

  /**
   * Generate migration report sections
   */
  private generateMigrationSections(result: MigrationResult): ReportSection[] {
    const sections: ReportSection[] = [];

    // Overview section
    sections.push({
      title: 'Migration Overview',
      type: 'overview',
      content: {
        totalFiles: result.progress.totalFiles,
        totalCandles: result.progress.totalCandles,
        migratedFiles: result.migratedFiles.length,
        failedFiles: result.failedFiles.length,
        duration: this.formatDuration(result.duration),
        startTime: new Date(result.progress.startTime).toISOString(),
        endTime: new Date(
          result.progress.startTime + result.duration
        ).toISOString(),
      },
    });

    // Performance section
    sections.push({
      title: 'Performance Metrics',
      type: 'performance',
      content: result.performance,
      charts: [
        {
          type: 'bar',
          title: 'Migration Performance',
          data: {
            labels: ['Candles/sec', 'MB/sec', 'Avg Batch Time (ms)'],
            values: [
              result.performance.candlesPerSecond,
              result.performance.mbPerSecond,
              result.performance.averageBatchTime,
            ],
          },
        },
      ],
    });

    // Errors section (if any)
    if (result.failedFiles.length > 0 || result.progress.errors.length > 0) {
      sections.push({
        title: 'Errors and Issues',
        type: 'errors',
        content: {
          failedFiles: result.failedFiles,
          errors: result.progress.errors,
          warnings: result.progress.warnings,
        },
      });
    }

    // File details section
    sections.push({
      title: 'File Processing Details',
      type: 'files',
      content: {
        migratedFiles: result.migratedFiles.slice(0, 100), // Limit for readability
        totalMigrated: result.migratedFiles.length,
      },
    });

    return sections;
  }

  /**
   * Generate validation report sections
   */
  private generateValidationSections(
    validation: ValidationReport
  ): ReportSection[] {
    const sections: ReportSection[] = [];

    // Validation overview
    sections.push({
      title: 'Validation Overview',
      type: 'validation',
      content: validation.summary,
    });

    // Error analysis
    if (validation.summary.totalErrors > 0) {
      sections.push({
        title: 'Error Analysis',
        type: 'errors',
        content: {
          commonErrors: validation.summary.commonErrors,
          sampleErrors: validation.sampleErrors,
        },
        charts: [
          {
            type: 'pie',
            title: 'Error Distribution',
            data: {
              labels: validation.summary.commonErrors.map((e) => e.type),
              values: validation.summary.commonErrors.map((e) => e.count),
            },
          },
        ],
      });
    }

    // Recommendations
    sections.push({
      title: 'Recommendations',
      type: 'recommendations',
      content: {
        recommendations: validation.recommendations,
      },
    });

    return sections;
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(data: ReportData, config: ReportConfig): string {
    const title = `${data.metadata.reportType.toUpperCase()} Report`;
    const timestamp = new Date(data.metadata.generatedAt).toLocaleString();

    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 5px; margin-bottom: 30px; }
        .status-success { color: #28a745; }
        .status-partial { color: #ffc107; }
        .status-failed { color: #dc3545; }
        .section { margin-bottom: 30px; }
        .section h2 { border-bottom: 1px solid #ddd; padding-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-label { font-weight: bold; }
        .error { color: #dc3545; }
        .warning { color: #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${title}</h1>
        <p>Generated: ${timestamp}</p>
    </div>

    <div class="summary">
        <h2>Executive Summary</h2>
        <p class="status-${data.summary.status.toLowerCase()}">
            <strong>Status: ${data.summary.status}</strong>
        </p>
        <div class="metrics">
            <div class="metric">
                <span class="metric-label">Total Files:</span> ${
                  data.summary.metrics.totalFiles
                }
            </div>
            <div class="metric">
                <span class="metric-label">Total Candles:</span> ${data.summary.metrics.totalCandles.toLocaleString()}
            </div>
            <div class="metric">
                <span class="metric-label">Success Rate:</span> ${(
                  data.summary.metrics.successRate * 100
                ).toFixed(2)}%
            </div>
            <div class="metric">
                <span class="metric-label">Duration:</span> ${
                  data.summary.metrics.duration
                }
            </div>
            <div class="metric">
                <span class="metric-label">Performance:</span> ${
                  data.summary.metrics.performance
                }
            </div>
        </div>
        
        <h3>Key Findings</h3>
        <ul>
            ${data.summary.findings
              .map((finding) => `<li>${finding}</li>`)
              .join('')}
        </ul>
        
        <h3>Recommendations</h3>
        <ul>
            ${data.summary.recommendations
              .map((rec) => `<li>${rec}</li>`)
              .join('')}
        </ul>
    </div>
`;

    // Add sections
    for (const section of data.sections) {
      html += `
    <div class="section">
        <h2>${section.title}</h2>
        ${this.renderSectionContent(section)}
    </div>`;
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Generate Markdown report
   */
  private generateMarkdownReport(
    data: ReportData,
    config: ReportConfig
  ): string {
    const title = `${data.metadata.reportType.toUpperCase()} Report`;
    const timestamp = new Date(data.metadata.generatedAt).toLocaleString();

    let markdown = `# ${title}

**Generated:** ${timestamp}

## Executive Summary

**Status:** ${data.summary.status}

### Metrics
- **Total Files:** ${data.summary.metrics.totalFiles}
- **Total Candles:** ${data.summary.metrics.totalCandles.toLocaleString()}
- **Success Rate:** ${(data.summary.metrics.successRate * 100).toFixed(2)}%
- **Duration:** ${data.summary.metrics.duration}
- **Performance:** ${data.summary.metrics.performance}

### Key Findings
${data.summary.findings.map((finding) => `- ${finding}`).join('\n')}

### Recommendations
${data.summary.recommendations.map((rec) => `- ${rec}`).join('\n')}

`;

    // Add sections
    for (const section of data.sections) {
      markdown += `## ${section.title}\n\n`;
      markdown += this.renderSectionMarkdown(section);
      markdown += '\n\n';
    }

    return markdown;
  }

  /**
   * Generate CSV report
   */
  private generateCsvReport(data: ReportData, config: ReportConfig): string {
    // Simple CSV with key metrics
    let csv = 'Metric,Value\n';
    csv += `Status,${data.summary.status}\n`;
    csv += `Total Files,${data.summary.metrics.totalFiles}\n`;
    csv += `Total Candles,${data.summary.metrics.totalCandles}\n`;
    csv += `Success Rate,${(data.summary.metrics.successRate * 100).toFixed(
      2
    )}%\n`;
    csv += `Duration,${data.summary.metrics.duration}\n`;
    csv += `Performance,${data.summary.metrics.performance}\n`;

    return csv;
  }

  /**
   * Render section content for HTML
   */
  private renderSectionContent(section: ReportSection): string {
    switch (section.type) {
      case 'overview':
        return this.renderOverviewTable(section.content);
      case 'performance':
        return this.renderPerformanceTable(section.content);
      case 'errors':
        return this.renderErrorsTable(section.content);
      default:
        return `<pre>${JSON.stringify(section.content, null, 2)}</pre>`;
    }
  }

  /**
   * Render section content for Markdown
   */
  private renderSectionMarkdown(section: ReportSection): string {
    switch (section.type) {
      case 'overview':
        return this.renderOverviewMarkdown(section.content);
      case 'performance':
        return this.renderPerformanceMarkdown(section.content);
      case 'errors':
        return this.renderErrorsMarkdown(section.content);
      default:
        return `\`\`\`json\n${JSON.stringify(
          section.content,
          null,
          2
        )}\n\`\`\``;
    }
  }

  /**
   * Render overview table
   */
  private renderOverviewTable(content: any): string {
    return `
<table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Files</td><td>${content.totalFiles}</td></tr>
    <tr><td>Total Candles</td><td>${
      content.totalCandles?.toLocaleString() || 'N/A'
    }</td></tr>
    <tr><td>Migrated Files</td><td>${content.migratedFiles || 'N/A'}</td></tr>
    <tr><td>Failed Files</td><td>${content.failedFiles || 'N/A'}</td></tr>
    <tr><td>Duration</td><td>${content.duration || 'N/A'}</td></tr>
    <tr><td>Start Time</td><td>${content.startTime || 'N/A'}</td></tr>
    <tr><td>End Time</td><td>${content.endTime || 'N/A'}</td></tr>
</table>`;
  }

  /**
   * Render overview markdown
   */
  private renderOverviewMarkdown(content: any): string {
    return `| Metric | Value |
|--------|-------|
| Total Files | ${content.totalFiles} |
| Total Candles | ${content.totalCandles?.toLocaleString() || 'N/A'} |
| Migrated Files | ${content.migratedFiles || 'N/A'} |
| Failed Files | ${content.failedFiles || 'N/A'} |
| Duration | ${content.duration || 'N/A'} |
| Start Time | ${content.startTime || 'N/A'} |
| End Time | ${content.endTime || 'N/A'} |`;
  }

  /**
   * Render performance table
   */
  private renderPerformanceTable(content: any): string {
    return `
<table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Candles per Second</td><td>${
      content.candlesPerSecond?.toFixed(2) || 'N/A'
    }</td></tr>
    <tr><td>MB per Second</td><td>${
      content.mbPerSecond?.toFixed(2) || 'N/A'
    }</td></tr>
    <tr><td>Average Batch Time (ms)</td><td>${
      content.averageBatchTime?.toFixed(2) || 'N/A'
    }</td></tr>
</table>`;
  }

  /**
   * Render performance markdown
   */
  private renderPerformanceMarkdown(content: any): string {
    return `| Metric | Value |
|--------|-------|
| Candles per Second | ${content.candlesPerSecond?.toFixed(2) || 'N/A'} |
| MB per Second | ${content.mbPerSecond?.toFixed(2) || 'N/A'} |
| Average Batch Time (ms) | ${content.averageBatchTime?.toFixed(2) || 'N/A'} |`;
  }

  /**
   * Render errors table
   */
  private renderErrorsTable(content: any): string {
    let html = '';

    if (content.errors && content.errors.length > 0) {
      html += '<h3>Errors</h3><ul>';
      for (const error of content.errors.slice(0, 10)) {
        html += `<li class="error">${error}</li>`;
      }
      html += '</ul>';
    }

    if (content.warnings && content.warnings.length > 0) {
      html += '<h3>Warnings</h3><ul>';
      for (const warning of content.warnings.slice(0, 10)) {
        html += `<li class="warning">${warning}</li>`;
      }
      html += '</ul>';
    }

    return html;
  }

  /**
   * Render errors markdown
   */
  private renderErrorsMarkdown(content: any): string {
    let markdown = '';

    if (content.errors && content.errors.length > 0) {
      markdown += '### Errors\n';
      for (const error of content.errors.slice(0, 10)) {
        markdown += `- ${error}\n`;
      }
      markdown += '\n';
    }

    if (content.warnings && content.warnings.length > 0) {
      markdown += '### Warnings\n';
      for (const warning of content.warnings.slice(0, 10)) {
        markdown += `- ${warning}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }

  /**
   * Log progress to console
   */
  private logProgress(progress: MigrationProgress): void {
    const percent =
      progress.totalCandles > 0
        ? ((progress.migratedCandles / progress.totalCandles) * 100).toFixed(1)
        : '0.0';

    const eta = progress.estimatedCompletion
      ? new Date(progress.estimatedCompletion).toLocaleTimeString()
      : 'Unknown';

    console.log(
      `Migration Progress: ${percent}% (${progress.migratedCandles}/${progress.totalCandles} candles) ` +
        `Files: ${progress.processedFiles}/${progress.totalFiles} ` +
        `Memory: ${progress.memoryUsageMB.toFixed(1)}MB ` +
        `ETA: ${eta}`
    );
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get report history
   */
  getReportHistory(): string[] {
    return [...this.reportHistory];
  }

  /**
   * Clear report history
   */
  clearReportHistory(): void {
    this.reportHistory = [];
  }
}
