import { SphereGeometry, /*TorusGeometry,*/ CylinderGeometry } from 'three'
import { Mesh, MeshBasicMaterial, Group } from 'three'

import { COLSET } from '@/domain/animation/AnimStruct'

import { type ColorInd, type ModelGroup } from '@/types/AnimTypes'

export const NONE = (/*multi: number, color: ColorInd, girth: number*/): ModelGroup => {
    const emptyGroup = new Group() as ModelGroup
    emptyGroup.size = 0
    return emptyGroup
  },
  POI = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!

    const cylinder = new Mesh(
      new CylinderGeometry(0.05 * multi * girth, 0.05 * multi * girth, 2.7 * multi, 32),
      new MeshBasicMaterial({ color: cset[2] }),
    )
    cylinder.position.y = 1.2 * multi

    const handle = new Mesh(
      new SphereGeometry(0.06 * multi * girth, 20, 20),
      new MeshBasicMaterial({ color: cset[1] }),
    )
    handle.position.y = -0.12 * multi

    const head = new Mesh(
      new SphereGeometry(0.2 * multi * girth, 20, 20),
      new MeshBasicMaterial({ color: cset[0] }),
    )
    head.position.y = 2.4 * multi
    /*
    const test1 = new Mesh(
        new SphereGeometry(0.06 * multi, 20, 20),
        new MeshBasicMaterial({color: 0xFF0000 })
    )
    test1.position.z = -0.5 * multi
    test1.position.y = 1 * multi

    const test2 = new Mesh(
        new SphereGeometry(0.06 * multi, 20, 20),
        new MeshBasicMaterial({color: 0xFF0000 })
    )
    test2.position.z = 0.5 * multi
    test2.position.y = 1 * multi
*/
    const model2 = new Group() as ModelGroup
    model2.add(cylinder)
    model2.add(head)
    model2.add(handle)
    //model2.add( test1 )
    //model2.add( test2 )

    model2.size = 2.4 * multi // Used for Y offset manipulations, multiplied by -1 to 1

    return model2
  },
  STAFF = (multi: number, color: ColorInd, girth: number): ModelGroup => {
    const cset = COLSET[color]!

    const cylinder = new Mesh(
      new CylinderGeometry(0.05 * multi * girth, 0.05 * multi * girth, 4.8 * multi, 32),
      new MeshBasicMaterial({ color: cset[2] }),
    )
    cylinder.position.y = 0

    const handle = new Mesh(
      new SphereGeometry(0.06 * multi * girth, 20, 20),
      new MeshBasicMaterial({ color: cset[1] }),
    )
    handle.position.y = -0.12 * multi

    const head1 = new Mesh(
      new SphereGeometry(0.2 * multi * girth, 20, 20),
      new MeshBasicMaterial({ color: cset[0] }),
    )
    head1.position.y = 2.4 * multi

    const head2 = new Mesh(
      new SphereGeometry(0.2 * multi * girth, 20, 20),
      new MeshBasicMaterial({ color: cset[1] }),
    )
    head2.position.y = -2.4 * multi

    const model2 = new Group() as ModelGroup
    model2.add(cylinder)
    model2.add(head1)
    model2.add(head2)

    model2.size = 2.4 * multi // Used for Y offset manipulations, multiplied by -1 to 1

    return model2
  }
