import { Command, Flags, Args } from '@oclif/core';
import { loadConfig } from 'meme-gtd-config';
import { ProjectService } from 'meme-gtd-core';

export default class ProjectUpdate extends Command {
    static summary = 'Update a project';
    static description = 'Update project name, description, status, or schedule.';
    static usage = ['<%= command.id %> <project-id> [--name <text>] [--description <text>] [--status <status>] [--start-date <date>] [--end-date <date>] [--json]'];
    static examples = [
        '$ mgtd project update 1 --name "New Name"',
        '$ mgtd project update 2 --status active',
        '$ mgtd project update 3 --start-date 2023-01-01 --end-date 2023-12-31',
        '$ mgtd project update 4 --description "Updated description" --json'
    ];

    static args = {
        'project-id': Args.integer({
            description: 'Project ID',
            required: true
        })
    };

    static flags = {
        name: Flags.string({
            char: 'n',
            summary: 'New project name',
            description: 'Update the project name'
        }),
        description: Flags.string({
            char: 'd',
            summary: 'New project description',
            description: 'Update the project description'
        }),
        status: Flags.string({
            summary: 'New project status',
            description: 'Update the project status (planned, active, paused, done, canceled)',
            options: ['planned', 'active', 'paused', 'done', 'canceled']
        }),
        'start-date': Flags.string({
            summary: 'New start date (YYYY-MM-DD)',
            description: 'Update the project start date'
        }),
        'end-date': Flags.string({
            summary: 'New end date (YYYY-MM-DD)',
            description: 'Update the project end date'
        }),
        json: Flags.boolean({
            char: 'j',
            summary: 'Return JSON output',
            description: 'Emit the updated project as JSON',
            default: false
        })
    } as const;

    async run(): Promise<void> {
        const { args, flags } = await this.parse(ProjectUpdate);
        const projectId = args['project-id'];
        const { config } = await loadConfig({ createIfMissing: true });
        const service = new ProjectService({ config });

        try {
            const project = service.update(projectId, {
                name: flags.name,
                description: flags.description,
                status: flags.status as any,
                startDate: flags['start-date'],
                endDate: flags['end-date']
            });

            if (flags.json) {
                this.log(JSON.stringify(project, null, 2));
                return;
            }

            // Human-readable output
            this.log(`Project #${project.id} updated:`);
            this.log(`Name: ${project.name}`);
            if (project.description) {
                this.log(`Description: ${project.description}`);
            }
            this.log(`Status: ${project.status}`);
            if (project.startDate) {
                this.log(`Start Date: ${project.startDate}`);
            }
            if (project.endDate) {
                this.log(`End Date: ${project.endDate}`);
            }
        } catch (error) {
            if (error instanceof Error) {
                this.error(error.message, { exit: 1 });
            }
            throw error;
        }
    }
}
